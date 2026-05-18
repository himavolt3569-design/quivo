# Quivo — Production Feature Rollout Plan

## Context

A full-session audit of the Quivo codebase (Next.js 16 + Supabase, Nepal-first POS / e-commerce SaaS for kirana shops) surfaced ~50 feature gaps spanning compliance (VAT, refunds), operations (bulk import, expiry tracking, day-end close), production readiness (PWA, offline POS, error monitoring), customer growth (reviews, tracking, loyalty), and identity (2FA, account deletion, audit log UI). Several supporting tables already exist with no UI (security_events, payment_audit_logs, wallet_transactions, saved_products, kyc_*_email_sent_at columns) — meaning a meaningful share of the work is "wire up the rest" rather than greenfield.

This plan turns that audit into an executable 11-phase incremental rollout where each phase ends in a shippable, working slice. No temp fixes. No half-finished features. Every checkbox must be true for the phase to be marked complete.

**User-confirmed scope decisions:**
- **VAT**: Build for both registered (mandatory 13% itemization, monthly VAT-3 export) and unregistered shops (per-shop toggle hides tax). VAT report stays in Phase 1.
- **Deferred items kept in scope**: order tracking map, back-in-stock alerts, abandoned cart, web push — none dropped.
- **Phase 0 scope**: maximum foundation (logger, sendEmail shell, cron route, event bus stub, migration-collision check).

**Migration timestamp collisions to fix first** — same timestamp pairs exist:
- `20260516000001_staff_shifts.sql` ↔ `20260516000001_supplier_profile_and_ledger.sql`
- `20260516000002_kyc_grace_period_notifications.sql` ↔ `20260516000002_payroll_templates.sql`

---

## Phasing Principles

1. **Every phase is shippable on its own.** Stop after any phase and the app is in a coherent state.
2. **Money-correct features come before delight features.** Tax and refunds before email receipts. VAT-3 report before per-product margin.
3. **Foundation is paid for in Phase 0.** Logger, email shell, cron, event bus, migration check — once, then every later phase reuses them.
4. **Schema freezes ratchet forward.** Once a function signature is shipped (e.g., `complete_pos_sale` after Phase 1), later phases cannot break it; they add a v-next alongside.
5. **Each deliverable has a verification step.** "Implemented" without a way to prove it works is not done.
6. **Realtime, RLS, and money columns are non-negotiable on writes.** Read paths can be lenient on legacy data.

---

## Definition of "Works Perfectly"

A feature is only checked off when **all of these** are true:

- TypeScript clean (`npx tsc --noEmit`) — no new errors anywhere in the repo.
- RLS policy exists for every new table; tested by attempting unauthorized read/write.
- Money columns are `NUMERIC(12,2)`; no floats.
- Timestamps are `TIMESTAMPTZ` stored UTC; UI renders with `toLocaleString`.
- Server actions use a shared Zod schema from `lib/validation.ts`.
- Client forms use the validated inputs (`PhoneInput`, `EmailInput`) where applicable.
- Empty / error / loading states are explicit (no blank screens, no silent failures).
- New tables added to `supabase_realtime` publication only when realtime is actually used.
- Documented in a one-line entry in the module's header comment.
- Smoke-tested manually with the verification step below.

---

## Phase 0 — Foundation

**Goal:** make every later phase faster and stop the bleeding on conflicts/observability.

### Deliverables

- [x] **Rename colliding migrations** to unique timestamps. The 2026-05-16 pair is now `…000001_staff_shifts.sql`, `…000002_payroll_templates.sql`, `…000003_supplier_profile_and_ledger.sql`, `…000004_kyc_grace_period_notifications.sql`. Two legacy 2024 collisions are grandfathered by the check script (already applied to existing DBs).
- [x] **Delete dead routes** — removed `app/product/[barcode]/`, `app/[shop]/`, and the empty `app/dashboard/owner/products/[id]/` shell. `[productId]` is the canonical edit route.
- [x] **CI workflow** at `.github/workflows/ci.yml`: pnpm install + `pnpm check:migrations` + `pnpm lint` + `pnpm typecheck` on every push to non-main branches and PRs to `main`.
- [x] **Migration-collision check** at `scripts/check-migration-names.mjs` (Node ESM, no deps). Reusable from CI and from `scripts/git-hooks/pre-commit` (install with `bash scripts/git-hooks/install.sh`). Rejects malformed names and new collisions; allowlists two legacy 2024 collisions.
- [x] **Structured logger** at `lib/log.ts` — Next.js-native (works on edge / Node / browser), structured JSON in prod, prettified in dev. `log.info/warn/error/fatal/debug/child`. Lazy AsyncLocalStorage binding for `requestId/userId/shopId`. `middleware.ts` stamps `x-request-id` on every request. Every existing `console.error/warn/info` in `app/` and `lib/` migrated (12 files).
- [x] **Sentry integration scaffolded** — `lib/sentry.ts` wrapper with `captureException/captureMessage/setSentryUser/flushSentry`. `instrumentation.ts` + Sentry init appended to `instrumentation-client.ts`. Activation requires `pnpm add @sentry/nextjs` plus setting `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`; the wrapper is a structured-log no-op until then so the codebase ships today.
- [x] **Generic email shell** at `lib/email/send.ts` — Resend-backed `sendEmail({ to, subject, html|react|text, tags, … })`. Dev no-op when `RESEND_API_KEY` is unset. Shared HTML scaffold at `lib/email/layout.ts`. `lib/kyc-compliance.ts` refactored to delegate; KYC template extracted to `emails/KycComplianceEmail.ts` (pure function — React-Email-render compatible later).
- [x] **Cron route handler** at `app/api/cron/[job]/route.ts` — dispatches by slug to `lib/cron/registry.ts`, authenticates via `x-cron-secret` (also accepts Vercel's `Authorization: Bearer`), per-job timeout with abort, structured JSON response `{ ok, job, ranAt, durationMs, result }`. `/api/cron/_list` returns the registered jobs. `noop` job registered.
- [x] **Vercel cron config** in `vercel.json` (currently just `/api/cron/noop` monthly; later phases add KYC daily, low-stock daily, abandoned-cart hourly).
- [x] **Domain event bus** at `lib/events/emit.ts` — `emit({ name, payload, shopId, userId, aggregateId, idempotencyKey })` upserts to `domain_events` with service-role admin client. Strict RLS deny for authenticated/anon. Idempotency-key unique index supports retry-safe writes. `emitBackground()` helper for fire-and-forget.
- [x] **Migration** `supabase/migrations/20260516000005_domain_events.sql` — `domain_events` table + indexes + RLS deny policies.
- [x] **Owner sidebar role plumbing** — `OwnerSidebar` and `OwnerMobileNav` accept `role?: ShopRole`. `OwnerLayout` passes `activeShop?.role`. `OWNER_ROUTES` typed with an optional `roles?: ShopRole[]` allow-list; filtering logic lands in Phase 1.

### Migration: `supabase/migrations/[next]_phase0_domain_events.sql`

- `domain_events` table with RLS.
- No realtime publication add yet.

### Verification

- [x] `pnpm typecheck`, `pnpm lint`, and `pnpm check:migrations` all pass locally. `pnpm verify` runs all three in one command.
- [x] The migration check rejects a duplicate-timestamp file when added (smoke-tested by creating a collision and running the script — exit 1 + clear error).
- [ ] **Operator step** — apply the `20260516000005_domain_events.sql` migration to the Supabase project. After that: `curl -H "x-cron-secret: $CRON_SECRET" $URL/api/cron/noop` returns 200; without the header returns 401.
- [ ] **Operator step** — after `pnpm add @sentry/nextjs` and setting `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN`, throw a test error and confirm both server and client events land in Sentry.
- [ ] **Operator step** — with `RESEND_API_KEY` set, `await sendEmail({ to: 'me@example.com', subject: 'test', html: '<p>hi</p>' })` delivers; without the key, the call returns `{ ok: false, skipped: true }` and logs a structured `info`.
- [ ] **Operator step** — after applying the domain_events migration: `await emit({ name: 'test.event', payload: { foo: 1 } })` writes a row visible to the service role.

---

## Phase 1 — Money Correctness

**Goal:** every receipt, order, and refund is auditable and tax-compliant. No more drift between the POS revenue path and the storefront revenue path.

### Schema migrations (in this order)

1. `[next]_tax_columns_on_transactions.sql`
   - `shop_transactions` adds `tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0`, `tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0`, `discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0`, `subtotal NUMERIC(12,2)` (backfill from `amount - tax_amount + discount_amount` for legacy rows; then NOT NULL).
   - `orders` adds `tax_amount`, `discount_amount`, `delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0`, `service_charge NUMERIC(12,2) NOT NULL DEFAULT 0`, `subtotal`, `tax_rate`.
   - `shops` adds `vat_registered BOOLEAN NOT NULL DEFAULT false`, `vat_rate NUMERIC(5,2) NOT NULL DEFAULT 13.00`, `pan_number TEXT`.
2. `[next]_pos_sale_v3_with_tax.sql`
   - `CREATE OR REPLACE FUNCTION complete_pos_sale(p_shop_id UUID, p_items JSONB, p_subtotal NUMERIC, p_discount NUMERIC, p_tax_rate NUMERIC, p_tax_amount NUMERIC, p_total NUMERIC, p_payment_method TEXT, p_notes TEXT, p_split_payments JSONB DEFAULT NULL) RETURNS UUID`.
   - Writes split_payment rows to new `transaction_splits` table when `p_split_payments` provided.
3. `[next]_storefront_order_v2_with_tax.sql`
   - Mirror tax/fee fields on `place_storefront_order` RPC. Keeps POS and storefront in sync.
4. `[next]_refunds.sql`
   - `refunds` table: id, shop_id, transaction_id NULLABLE, order_id NULLABLE (at least one required), refund_amount, tax_refunded, reason, status (`pending`|`approved`|`rejected`|`completed`), processed_by, created_at, processed_at.
   - `refund_items` (id, refund_id, product_id, qty, line_amount) — supports partial refunds.
   - `process_refund(p_refund_id)` RPC: validates auth, restores inventory atomically, marks refund completed, writes `domain_events` row `refund.completed`.
   - RLS: managers/owners only.
5. `[next]_audit_views.sql`
   - Read-only `v_security_events_user` and `v_payment_audit_logs_shop` views that join in user names. Granted to authenticated.

### UI / actions

- [ ] **POSView tax + item discount + split payment** (`components/dashboard/owner/pos/POSView.tsx`):
  - Per-line discount control on each cart row (alongside existing order-level discount).
  - Tax line in the cart footer driven by `shop.vat_registered` flag.
  - Split-payment picker: pick 1–3 methods that sum to total.
  - `printBill` adds: PAN number (if set), subtotal, item discounts, order discount, tax line `13% VAT — Rs. X.XX`, grand total.
  - Receipt re-print button on the success modal that persists past closing the modal (kept in `useState` or `sessionStorage`).
  - Held-sale ("park") action: stores the current cart to a new `held_sales` row, restorable from a "Resume" button.
- [ ] **Owner orders refund flow** (`app/dashboard/owner/orders/page.tsx`, `components/dashboard/owner/orders/OrderList.tsx`):
  - "Refund" button on a paid order opens a modal: pick lines + qty, enter reason.
  - On submit: insert `refund` + `refund_items` rows, call `process_refund` RPC, surface success/failure toast.
- [ ] **Storefront checkout tax display** (`components/storefront/CheckoutModal.tsx`):
  - Order summary shows subtotal, delivery, tax, total (whatever shop is configured for).
- [ ] **Sidebar role gating** (`components/dashboard/owner/OwnerSidebar.tsx`):
  - Filter `OWNER_ROUTES` based on `role` prop. `cashier` sees POS + Inventory + Customers only. `inventory` sees Inventory + Suppliers only. `viewer` sees Overview + Finances. Owner/admin/manager see everything.
- [ ] **Audit log UI** at `/dashboard/owner/settings/audit`:
  - List `payment_audit_logs` for the active shop, paginated, with date-range filter.
  - List `security_events` for the current user.
  - Reuse the existing `downloadCsv` pattern from `components/dashboard/owner/payroll/PayrollView.tsx`.
- [ ] **VAT-3 monthly export** at `/dashboard/owner/payroll/vat` (or `/dashboard/owner/finances/vat`):
  - Month picker. CSV columns: invoice no, date, customer PAN (if any), taxable amount, tax amount, total. Matches Nepal IRD VAT-3 format.
  - Server action `getVatReport(shopId, year, month)` queries `shop_transactions` + `orders` and returns the rows.
- [ ] **Event emit** — after every successful `complete_pos_sale` and `place_storefront_order`, server action calls `emit('transaction.completed', { transaction_id, shop_id })`. Phase 2 will consume.

### Verification

- [ ] Sell 3 items at POS as a VAT-registered shop → printed receipt shows 13% tax line, totals balance to the rupee.
- [ ] Sell at POS as an unregistered shop → no tax line, no tax row in DB (`tax_amount = 0`).
- [ ] Refund 1 of 3 items on an order → that product's stock goes up by exactly the refunded qty; `refund` row + `refund_items` row exist; original transaction is unchanged.
- [ ] Split a Rs. 1000 sale: 600 cash + 400 QR. `transaction_splits` has two rows summing to 1000.
- [ ] Hold a cart, close POS, reopen → cart restorable from a "Held sales" panel.
- [ ] As a `cashier`-role user, owner sidebar hides Payments, Finances, Payroll, Settings.
- [ ] VAT-3 CSV for current month opens in LibreOffice, totals tie to the finance dashboard.

---

## Phase 2 — Email + Notification Platform

**Goal:** every transactional event the user expects to be told about, gets sent. Both inboxes and an in-app bell.

### Schema migrations

- `[next]_notifications.sql`
  - `notifications` table: id, user_id, kind (enum), title, body, link_url, read_at, created_at.
  - Adds `notifications` to `supabase_realtime` publication with `REPLICA IDENTITY FULL`.
- `[next]_notification_preferences.sql`
  - Per-user toggles per kind across channels (email, in-app, sms, push). Row-per-user, JSONB column for flexibility.

### Deliverables

- [ ] **React Email templates** under `emails/`:
  - `OrderConfirmationEmail.tsx` (customer receives after checkout).
  - `OrderStatusUpdateEmail.tsx` (status changes: confirmed → packing → out for delivery → delivered).
  - `PaymentReceiptEmail.tsx` (after `payment_verified`).
  - `PasswordChangedEmail.tsx`, `EmailChangedEmail.tsx` (after self-service identity changes — wired in Phase 9).
  - `LowStockDigestEmail.tsx` (daily owner digest).
  - `RefundProcessedEmail.tsx`.
  - All shop-branded (logo, theme color from `shops` row).
- [ ] **Notification dispatcher** at `lib/events/handlers/transaction-completed.ts`:
  - Subscribes via a Postgres trigger or polling cron job that reads unprocessed `domain_events` and dispatches to handlers.
  - For `transaction.completed`: send order confirmation email + write a `notifications` row for the owner ("Sale of Rs. X completed").
- [ ] **In-app notification bell** at `components/dashboard/NotificationBell.tsx`:
  - Bell icon in header (`app/dashboard/layout.tsx`), badge with unread count.
  - Subscribes to `notifications` realtime filtered by `user_id`.
  - Click opens a popover list; clicking an item navigates to `link_url` and marks read.
  - "Mark all read" action.
- [ ] **Notification preferences page** at `/dashboard/(customer)/profile/notifications` and `/dashboard/owner/settings/notifications`:
  - Toggle each notification kind on/off per channel (email / in-app / push / sms — sms+push greyed out until later phases).
- [ ] **Low-stock cron job** registered at `lib/cron/registry.ts` as `low-stock-digest`:
  - Daily at 08:00 shop local time (use `shops.timezone` once Phase 4 adds it; until then UTC).
  - For each shop, gather products with `stock <= low_stock_threshold`. Send digest email + write notification row.
- [ ] **KYC compliance emails wired**:
  - Add `kyc-deadline` cron job. Reads `shops.kyc_*_email_sent_at` columns, fires the three stage emails per `lib/kyc-compliance.ts` schedule.
  - Removes any "silent dead" state — the migration `20260516000002_kyc_grace_period_notifications.sql` finally has a firing path.

### Verification

- [ ] Place an order on storefront → customer inbox gets the order confirmation, owner gets in-app notification within 5 seconds.
- [ ] Drop a product's stock below threshold, trigger cron manually via `curl /api/cron/low-stock-digest` → owner gets digest email + in-app notification.
- [ ] Turn off "order confirmation" in customer notification prefs → next order produces no email but still the in-app notification.
- [ ] Create a brand-new shop, advance system clock 7 days, trigger `kyc-deadline` → grace email is sent and `kyc_grace_email_sent_at` is populated.

---

## Phase 3 — Inventory Operations

**Goal:** a real kirana with 800 SKUs, daily expiries, and weekly POs can run their inventory end-to-end without leaving the app.

### Schema migrations

- `[next]_product_batches.sql`
  - `product_batches` (id, product_id, batch_no, expiry_date, received_qty, remaining_qty, cost_price, received_at, supplier_id NULLABLE).
  - Trigger keeps `products.stock = SUM(product_batches.remaining_qty)`.
  - `complete_pos_sale` v4 picks oldest expiry first (FEFO) and decrements `remaining_qty` per batch; writes `transaction_batch_consumption` rows for audit.
- `[next]_purchase_orders.sql`
  - `purchase_orders` (id, shop_id, supplier_id, status, ordered_at, expected_at, received_at, total_amount, notes).
  - `purchase_order_lines` (id, purchase_order_id, product_id, qty_ordered, qty_received, unit_cost).
  - `receive_purchase_order(p_po_id, p_received_lines JSONB)` RPC: validates, inserts `product_batches` rows, updates PO status to `received`, updates supplier `balance_due` only if billed-after-receive.
- `[next]_stock_takes.sql`
  - `stock_takes` (id, shop_id, started_at, completed_at, status, started_by, notes).
  - `stock_take_counts` (id, stock_take_id, product_id, system_qty, counted_qty, variance, variance_value).
  - `complete_stock_take(p_id)` RPC: writes `stock_adjustments` (new table) for each variance.
- `[next]_day_end.sql`
  - `day_end_closes` (id, shop_id, opened_at, closed_at, opening_cash, expected_cash, counted_cash, variance, notes, closed_by).
- `[next]_stock_transfers.sql`
  - `stock_transfers` (id, from_shop_id, to_shop_id, status, created_at, completed_at).
  - `stock_transfer_lines` (id, transfer_id, product_id, qty, source_batch_id NULLABLE, target_batch_id NULLABLE).
  - `execute_stock_transfer(p_id)` RPC: atomic move between batches.

### Deliverables

- [ ] **Bulk product CSV import** at `/dashboard/owner/products/import`:
  - Step 1: upload CSV, server parses to a preview table (first 50 rows) with column-mapping UI.
  - Step 2: row-by-row validation with error rows highlighted (uses `lib/validation.ts` schemas).
  - Step 3: dry-run summary ("142 will be created, 8 updated, 3 errors").
  - Step 4: async commit with progress bar (writes to `domain_events` per batch of 50; client polls for progress).
  - Template CSV download.
- [ ] **Expiry/batch UI in `ProductForm`**:
  - Existing form gains a "Batches" tab listing all active batches for the product.
  - "Receive stock" action (from supplier or manual) creates a new batch row.
- [ ] **POS FEFO**: cart auto-deducts from soonest-expiring batch. Receipt notes batch numbers (optional).
- [ ] **Purchase Order flow** at `/dashboard/owner/suppliers/[id]/purchase-orders`:
  - Create PO from a supplier page (pick products + qty + unit cost).
  - PO statuses: `draft` → `submitted` → `received` (partial OK) → `closed`.
  - "Receive" action opens line-by-line received-qty form; calls `receive_purchase_order`.
- [ ] **Stock Take** at `/dashboard/owner/products/stock-take`:
  - "Start stock take" lists every active product with current system qty.
  - Counter inputs counted_qty per product.
  - Variance column updates live.
  - "Finalise" → calls `complete_stock_take` → variances become stock_adjustments rows.
  - History view of past stock takes.
- [ ] **Day-end Z-report + cash drawer** at `/dashboard/owner/pos` (top bar action) and `/dashboard/owner/finances/day-end`:
  - "Open day" form: enter opening cash. Persists `day_end_closes` row in `opened` state.
  - "Close day" form: shows expected cash (cash sales − cash refunds + opening), counter enters counted cash, variance calculated. Closes the row.
  - Z-report printable: gross sales, tax collected, discounts given, refunds issued, cash/QR/credit split, per-staff totals.
- [ ] **Inter-shop stock transfer** at `/dashboard/owner/products/transfers`:
  - Only visible if owner has ≥2 shops. Pick source + destination + lines. Execute → atomic batch move.
- [ ] **Low-stock view** at `/dashboard/owner/products?filter=low_stock` (or `/dashboard/owner/products/low-stock`):
  - Lists all SKUs at/below threshold. "Create PO" CTA pre-fills a PO with all listed items.

### Verification

- [ ] Import a 500-row CSV with 8 deliberate errors → preview shows row-level errors, only good rows commit, owner gets a "342 imported, 8 skipped" summary email.
- [ ] Receive 3 batches of one product with different expiry dates → POS sells from soonest expiry first; can confirm via printed receipt batch numbers.
- [ ] Receive a PO partially (50 of 100 ordered) → PO status `partial`, supplier balance_due unchanged until invoice marked received.
- [ ] Conduct a stock take, count 3 SKUs short → variance shows in red, finalising writes stock_adjustments rows; finance dashboard shows the loss as an expense.
- [ ] Open day with Rs. 5000, do Rs. 12000 cash sales, refund Rs. 800 cash, close day with Rs. 16100 → variance Rs. -100 surfaced with reason field.
- [ ] Transfer 20 units between two shops → source stock −20, destination +20, history row exists.

---

## Phase 4 — Production Readiness

**Goal:** the app survives bad networks, can be installed to home screen, and doesn't go silent when something breaks.

### Deliverables

- [ ] **PWA manifest** at `app/manifest.ts` (Next 16 typed manifest) with name, icons (192, 512, maskable), theme colour, display `standalone`, start_url `/dashboard`, scope `/`.
- [ ] **Real service worker** at `public/sw.js` using Workbox precaching + runtime cache:
  - Stale-while-revalidate for navigation requests.
  - Cache-first for static assets (`/_next/static/**`).
  - Network-first for API routes; falls back to a custom offline page (`app/offline/page.tsx`).
  - Replaces the current stub.
- [ ] **Offline POS** — the critical one:
  - Client-side queue at `lib/offline/pos-queue.ts` backed by IndexedDB (`idb` library).
  - `complete_pos_sale` server action wrapped: if `navigator.onLine === false`, queue locally with a tentative UUID; show "queued" badge on the receipt.
  - Background sync registration; on `online` event, replays queue in order. Conflicts (e.g. negative stock from concurrent device) flagged in a "Sync errors" tray.
  - Receipt print works offline (data in queue).
  - Last 100 products cached for offline product lookup.
- [ ] **Web push (VAPID)**:
  - Generate VAPID keys, store as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
  - `push_subscriptions` table (id, user_id, endpoint, p256dh, auth, created_at).
  - `/api/push/subscribe` route to register; matching unsubscribe.
  - Push dispatcher in `lib/events/handlers/notify-push.ts` consumed alongside email/in-app.
  - Per-user toggle in notification prefs page (Phase 2).
- [ ] **`/api/health` endpoint** returning `{ db: 'ok'|'down', resend: 'ok'|'down', uptime, version }`. Pings Supabase and Resend with 1-second timeouts.
- [ ] **Image moderation hook** on every image upload:
  - Edge function or server action wrapping the Supabase Storage upload.
  - Calls a moderation API (start with simple file-size + MIME validation; add `@vercel/blob` or a SaaS moderator behind a feature flag).
  - Rejects on positive flag, logs to `security_events`.
- [ ] **Image optimization layer**:
  - Wrapper component `components/ui/ShopImage.tsx` around `next/image` configured with `loader: 'custom'` that signs Supabase Storage transform URLs (resize, webp).
  - All product / shop / staff images go through this.
- [ ] **SEO scaffolding**:
  - `app/sitemap.ts` lists all public shop pages + product pages.
  - `app/robots.ts`.
  - JSON-LD `Product` schema rendered on `/s/[slug]/product/[barcode]`.
  - Dynamic OG image generation at `app/s/[slug]/opengraph-image.tsx` using Next's `ImageResponse` API (auto-renders shop logo + name + theme color).
- [ ] **`shops.timezone` column** + UI selector in shop settings — needed for cron jobs that respect shop time.

### Verification

- [ ] Lighthouse PWA score ≥ 90 on `/`.
- [ ] Toggle Chrome DevTools to Offline, ring up a sale → "queued" badge, success modal still appears, receipt prints. Go online → sale lands in DB.
- [ ] `/api/health` returns 200 with both ok; stop Resend key, restart, get 503 with `resend: down`.
- [ ] Receive a web push on a subscribed device when a low-stock event fires.
- [ ] Open a product page in WhatsApp share → preview card shows custom OG image with shop branding.
- [ ] `curl /sitemap.xml` returns all live shop slugs.

---

## Phase 5 — Reporting & Analytics

**Goal:** the owner can answer any "how much / who / what / when" question without leaving the app or asking an accountant.

### Deliverables

- [ ] **Per-product profitability view** at `/dashboard/owner/products/profitability`:
  - Columns: product, units sold (range), revenue, COGS (sum of batch cost × qty consumed), gross margin %, current rate.
  - Sort by margin / revenue / volume.
  - CSV export.
- [ ] **Top customers + top products** at `/dashboard/owner/customers/top` and `/dashboard/owner/products/top`:
  - Configurable date range, "by revenue" / "by qty" toggle.
  - Pareto chart from `recharts`.
- [ ] **Sales-by-staff** at `/dashboard/owner/staff/sales`:
  - Joins `shop_transactions.created_by` to `shop_staff`.
  - Hours worked (from shifts) and sales rung-up side by side; sales/hour ratio.
- [ ] **Universal date-range + period-comparison** in `lib/reports/range.ts`:
  - `getRangeFromQuery(searchParams)` parses `?from=&to=&compare=prev_period` into `{ start, end, compareStart?, compareEnd? }`.
  - Used by Finance dashboard, Payroll, Orders, Customers, all top-N pages.
- [ ] **Finance dashboard comparison**:
  - Existing dashboard gets "vs last period" deltas next to each KPI.
- [ ] **Generic export adapter** at `lib/reports/csv.ts` + `lib/reports/pdf.ts`:
  - CSV reuses the existing pattern from `components/dashboard/owner/payroll/PayrollView.tsx` `downloadCsv`.
  - PDF via `@react-pdf/renderer` — one template per report.
  - All list pages get a single "Export" dropdown (CSV / PDF).

### Verification

- [ ] On a shop with one month of data, every page in the owner console exports CSV and PDF without errors.
- [ ] Profitability page shows realistic margins for at least 10 products.
- [ ] Sales-by-staff for the past week ties to the per-staff totals on individual receipts.
- [ ] Finance dashboard "vs last month" arrows point the right direction for revenue/expenses.

---

## Phase 6 — Customer-Facing Growth

**Goal:** the customer side stops being a basic catalog and becomes a place customers come back to.

### Schema migrations

- `[next]_reviews.sql` — `reviews` table (id, shop_id, product_id NULL, order_id NULL, customer_id, rating 1-5, body, status `pending`|`published`|`hidden`, moderated_by, created_at). Trigger updates `products.average_rating` + `products.review_count`. RLS allows customers to insert reviews only for products they've purchased.
- `[next]_promo_codes.sql` — `promo_codes` (id, shop_id, code, kind `percent`|`flat`, value, min_subtotal, max_uses, used_count, valid_from, valid_to, active). `apply_promo_code(p_code, p_shop_id, p_subtotal)` RPC returns discount amount + validates.
- `[next]_loyalty_redemption.sql` — `redeem_wallet_points(p_user_id, p_shop_id, p_points)` RPC that decrements wallet and returns rupee value (rate stored per shop).

### Deliverables

- [ ] **Order tracking map** at `/order/[orderNumber]`:
  - Existing page gains a Leaflet map (reuse the existing leaflet integration from `AddressPinPicker`).
  - For statuses `out_for_delivery`, shows shop pin → customer pin with a polyline; updates in realtime as a `delivery_locations` table gets pinged (this requires a courier app — for now mock the driver location at the shop or last-known-customer position).
- [ ] **Reviews + ratings**:
  - Customer can leave a review on a delivered order (one per order_item).
  - Star display on storefront product card + product detail page.
  - Owner moderation queue at `/dashboard/owner/customers/reviews`.
- [ ] **Wishlist surfacing**:
  - Existing `saved_products` rendered at `/dashboard/(customer)/saved` (already a route; ensure full functionality).
  - "Save" heart icon on every storefront product card.
- [ ] **Reorder previous order** action on `/dashboard/(customer)/orders`:
  - One tap → cart pre-filled with all items from that order. Out-of-stock items skipped with a notice.
- [ ] **Back-in-stock + price-drop alerts**:
  - When `products.stock` rises from 0 above 0 and a user has it saved → enqueue an in-app + email + push notification.
  - When `products.price` drops by >= 5% from the price at save time → same.
  - Stored alert prefs respected from Phase 2.
- [ ] **Coupon / promo code**:
  - Owner creates codes at `/dashboard/owner/payments/promo-codes`.
  - Customer enters code at checkout; `apply_promo_code` validates and reduces total. Code recorded on order.
- [ ] **Loyalty redemption**:
  - Wallet balance shown at checkout. Slider to redeem up to N points (configurable conversion rate per shop).
  - Redemption call in checkout server action; failure rolls back order.
- [ ] **Abandoned-cart recovery**:
  - `carts` table (id, customer_id, shop_id, items JSONB, updated_at). On every cart mutation, upsert to this table.
  - Cron job `abandoned-cart` runs hourly; emails customers whose cart hasn't been touched in 24 hours and isn't empty.

### Verification

- [ ] Customer leaves a 5-star review on a delivered order; appears on storefront after owner approval.
- [ ] Create a code "GRAND10" for 10% off; customer types it at checkout, total drops by 10%, order records `promo_code = GRAND10`.
- [ ] Save a product that's out of stock; restock it; customer gets an email + push within 1 minute.
- [ ] Add items to cart, walk away for 24 hours, get recovery email with one-tap link back.

---

## Phase 7 — Communication & Engagement

**Goal:** SMS, per-order chat, and bulk announcements. The "I want to reach my customer" gap closed.

### Schema migrations

- `[next]_chat_order_thread.sql` — `chat_messages` gains `order_id UUID NULL REFERENCES orders(id)`. Existing rows leave it null; new chats from an order detail page populate it.
- `[next]_announcements.sql` — `announcements` (id, shop_id, body, audience `all`|`recent_30d`|`saved_shop`, sent_at, recipient_count).
- `[next]_sms_log.sql` — `sms_log` table for delivery receipts.
- `[next]_server_carts.sql` — `carts` table (already created in Phase 6 if not; if already there, reuse).

### Deliverables

- [ ] **SMS via Twilio** at `lib/sms/send.ts`:
  - Single `sendSms({ to, body })`. Reads `TWILIO_*` env. Logs to `sms_log`.
  - Optional swap-in for a local Nepali SMS gateway via an `SMS_PROVIDER` env flag.
- [ ] **OTP signup / login** as alternative to email:
  - `/auth/otp` page. `request_otp(phone)` action sends a 6-digit code via `sendSms`; `verify_otp(phone, code)` upserts profile and signs in via Supabase Auth.
  - Rate-limited via existing `lib/rate-limit.ts`.
- [ ] **SMS delivery updates**:
  - When order status changes to `out_for_delivery` or `delivered`, send SMS (respecting customer prefs).
- [ ] **Per-order chat threads**:
  - Order detail page (`/order/[orderNumber]` and `/dashboard/owner/orders/[id]`) gets an embedded chat thread scoped to that order_id.
  - Reuse realtime pattern from `components/storefront/ChatWidget.tsx`.
- [ ] **Bulk announcements** at `/dashboard/owner/customers/announcements`:
  - Compose form, pick audience, send. Sends in-app notification + email; SMS if customer opted in.
  - Tracks recipient_count.
- [ ] **Server-side cart persistence**:
  - Customer's cart synced to `carts` table on every mutation. On login/device switch, cart hydrates from server.

### Verification

- [ ] Sign up a new account via OTP on a real Nepali phone number; receive SMS within 30 seconds.
- [ ] Place order, mark `out_for_delivery` → customer receives SMS.
- [ ] Open chat from an order detail page on owner side and customer side simultaneously → messages appear in realtime, scoped to that order.
- [ ] Send announcement to "recent 30-day customers" → recipient_count matches a manual count of distinct customers in that window.
- [ ] Add items to cart on phone, log in on laptop → same cart shows.

---

## Phase 8 — Internationalization & Accessibility

**Goal:** Nepali kirana customers can use the app in Nepali. Keyboard users and screen readers aren't second-class.

### Deliverables

- [ ] **next-intl setup**:
  - `i18n.ts` config, `messages/en.json` and `messages/ne.json` (Nepali) at minimum (Hindi optional).
  - Wrap `app/layout.tsx` with `NextIntlClientProvider`.
  - Replace hard-coded strings with `t('key')` calls across all routes. Priority: storefront, checkout, customer dashboard. Owner console can stay English-first.
- [ ] **Locale switcher** in the header — persists choice to a cookie + profile column.
- [ ] **Accessibility audit pass**:
  - Every input has a programmatic label.
  - Every button has discernible text (icon-only buttons get `aria-label`).
  - Focus visible on all interactive elements (Tailwind `focus-visible:ring`).
  - Modal focus traps (Radix Dialog already handles; verify all dialogs use it).
  - Keyboard nav: every page navigable without a mouse; tab order matches visual order.
  - Color contrast meets WCAG AA (audit with axe DevTools).
- [ ] **Theme toggle** wired with `next-themes` persistence at `/dashboard/owner/settings/appearance` and the customer profile page.

### Verification

- [ ] Switch locale to Nepali on the storefront — all customer-facing text renders in Nepali.
- [ ] Run axe DevTools on the storefront, checkout, customer dashboard, owner POS — zero serious or critical violations.
- [ ] Complete a full purchase (browse → cart → checkout → confirm) using only keyboard.

---

## Phase 9 — Identity & Security Hardening

**Goal:** owner accounts can be locked down. Users can leave with their data.

### Deliverables

- [ ] **2FA (TOTP) for owners and managers**:
  - Use Supabase Auth MFA APIs. Enrollment page at `/dashboard/owner/settings/security/2fa`.
  - Forced for `owner` and `admin` shop roles (configurable per shop).
  - Recovery codes generated on enrollment, displayed once.
- [ ] **Email change flow**:
  - `/dashboard/(customer)/profile/email` (and owner equivalent).
  - Enter new email → Supabase sends verification → confirms → updates auth.users and `profiles`.
  - Old email gets notification ("your email was changed").
- [ ] **Account deletion + data export** at `/dashboard/(customer)/profile/data`:
  - "Download my data" → ZIP of CSVs (profile, orders, addresses, wallet, reviews, chat history).
  - "Delete my account" → soft delete (mark `profiles.deleted_at`); hard delete via daily cron after 30-day grace.
  - Owner equivalent for shops they own; refuses if active orders exist.
- [ ] **Session management** at `/dashboard/(customer)/profile/sessions`:
  - List active Supabase sessions (use `auth.sessions` admin API).
  - "Sign out this device" / "Sign out all other devices".
- [ ] **Rate limit gap closure**:
  - Audit every public endpoint (`app/api/**`, every action in `app/actions/`) for missing `checkRateLimit` calls. Add where missing.
  - New `RATE_LIMITS` registry in `lib/rate-limit.ts` with named tiers.

### Verification

- [ ] Enable 2FA on an owner account; sign in requires TOTP code; lose access without it.
- [ ] Change email; verify both old and new addresses receive notifications.
- [ ] Delete account; 30 days later (or by manually triggering the cron) all PII gone, orders anonymized.
- [ ] Sign out other devices; verify second browser is signed out within seconds.

---

## Phase 10 — Multi-Shop & Scale

**Goal:** an owner with 3 shops doesn't have to switch contexts to do basic things.

### Deliverables

- [ ] **Consolidated dashboard** at `/dashboard/owner/all`:
  - All-shops view: revenue, orders, staff, top SKUs across the owner's shops.
  - Per-shop drill-down.
- [ ] **Cross-shop notifications** in the bell — group by shop.
- [ ] **Subscription billing scaffolding** (optional, can defer to product launch):
  - `subscription_plans`, `shop_subscriptions` tables.
  - Pricing tiers (free + paid).
  - Stripe / eSewa billing integration.
  - Feature flag system in `lib/billing/limits.ts` that gates premium features (e.g. >1 shop, >10 staff, multi-currency).

### Verification

- [ ] Owner with 3 shops sees aggregated revenue chart on `/dashboard/owner/all` that ties to the sum of individual shop dashboards.

---

## Critical Files Referenced

Files that will be touched repeatedly across phases — agree on conventions before forking:

- `lib/validation.ts` — every new form validator goes here.
- `lib/email/send.ts` (Phase 0) — every new transactional email goes through this.
- `lib/cron/registry.ts` (Phase 0) — every scheduled job is registered here.
- `lib/events/emit.ts` and `lib/events/handlers/` (Phase 0+) — fan-out for cross-cutting reactions.
- `lib/log.ts` (Phase 0) — every new module uses this, never `console.*`.
- `lib/reports/csv.ts` + `lib/reports/pdf.ts` (Phase 5) — all exports go through these.
- `components/dashboard/owner/pos/POSView.tsx` — cart/tax/discount/split/print state machine; freeze its `complete_pos_sale` contract at end of Phase 1.
- `components/dashboard/owner/OwnerSidebar.tsx` — role-aware nav.
- `supabase/migrations/` — strict timestamp + descriptive name. Pre-commit hook (Phase 0) enforces uniqueness.

## Migration Hygiene Going Forward

- Name: `YYYYMMDDHHMMSS_short_snake_case.sql`. Always include `HHMMSS`, not just `_NNN`.
- Each migration is forward-only and idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Functions use `CREATE OR REPLACE FUNCTION`; never rename a function in place — create vN+1 alongside vN.
- Realtime publication adds are guarded by `pg_publication_tables` check (pattern already in `20240101000019_storefront_v2.sql`).
- New tables get RLS on day one; policies tested in the migration's verification section.

## Estimated Effort (single engineer, sequential)

| Phase | Working days |
|---|---|
| 0 — Foundation | 5 |
| 1 — Money Correctness | 8 |
| 2 — Email + Notifications | 6 |
| 3 — Inventory Ops | 12 |
| 4 — Production Readiness | 8 |
| 5 — Reporting | 5 |
| 6 — Customer Growth | 10 |
| 7 — Communication | 6 |
| 8 — i18n + a11y | 7 |
| 9 — Identity / Security | 5 |
| 10 — Multi-Shop / Billing | 5 |
| **Total** | **~77 days (~16 weeks)** |

Two engineers reduce this by ~35% (more in middle phases that parallelize well, less in early phases that don't).

## How to Verify End-to-End

After each phase, run this sanity loop:

1. `pnpm install && npx tsc --noEmit` — zero errors anywhere.
2. `pnpm lint` — zero errors.
3. `supabase db reset && supabase db push` — every migration applies cleanly from scratch.
4. `pnpm dev` — boot the app, complete the phase-specific verification checklist above.
5. Smoke test the previous phase's flow — nothing should have regressed.
6. Update the checkboxes in this file with `[x]` for done items; merge.
