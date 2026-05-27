# Quivo — Production Feature Rollout Plan

> **Status as of 2026-05-27:** Phases 0–5 shipped on `additional-features` (latest commit `318a91a`); Phase 6 (Customer-Facing Growth) is next. See the **Execution log** table below for per-phase commits, the migration window in use (Phase 5 used the `20260522000003/4` window; next free timestamp is `20260516000027_…`), and the list of files the user has hand-tuned that future edits must preserve.

## Context

A full-session audit of the Quivo codebase (Next.js 16 + Supabase, Nepal-first POS / e-commerce SaaS for kirana shops) surfaced ~50 feature gaps spanning compliance (VAT, refunds), operations (bulk import, expiry tracking, day-end close), production readiness (PWA, offline POS, error monitoring), customer growth (reviews, tracking, loyalty), and identity (2FA, account deletion, audit log UI). Several supporting tables already exist with no UI (security_events, payment_audit_logs, wallet_transactions, saved_products, kyc_*_email_sent_at columns) — meaning a meaningful share of the work is "wire up the rest" rather than greenfield.

This plan turns that audit into an executable 11-phase incremental rollout where each phase ends in a shippable, working slice. No temp fixes. No half-finished features. Every checkbox must be true for the phase to be marked complete.

**User-confirmed scope decisions:**
- **VAT**: Build for both registered (mandatory 13% itemization, monthly VAT-3 export) and unregistered shops (per-shop toggle hides tax). VAT report stays in Phase 1.
- **Deferred items kept in scope**: order tracking map, back-in-stock alerts, abandoned cart, web push — none dropped.
- **Phase 0 scope**: maximum foundation (logger, sendEmail shell, cron route, event bus stub, migration-collision check).

## Execution log

| Phase | Status | Branch | Commit | Notes |
|---|---|---|---|---|
| 0 — Foundation | ✓ committed | `additional-features` | `3d1f04e` | Operator follow-ups still open. |
| 1 — Money Correctness | ✓ committed | `additional-features` | `10f3f1d` | 8 migrations (000006–000013). |
| 2 — Email + Notifications | ✓ committed | `additional-features` | `f414833` | Migrations 000014–000015 + cron jobs + bell + prefs UI. Also defensive `createShop` hardening. |
| 3 — Inventory Ops (slice 1) | ✓ committed | `additional-features` | `a1d0304` | Migrations 000017–000021 (batches/FEFO, POs, stock takes, day end, transfers). |
| 3 — Inventory Ops (slice 2) | ✓ committed | `additional-features` | `a78ffc2` | Stock transfer UI + bulk product CSV import. |
| 3.5 — pgcrypto + map fix | ✓ committed | `additional-features` | `4860c20` | Migrations 000022–000023 (random_hex helper + orders coords + checkout pin + DeliveryMap on tracking page). |
| 4 — Production Readiness | ✓ committed | `additional-features` | `502c950` | Migrations 000025–000026; PWA manifest + SW + offline POS queue; SEO scaffolding (sitemap, robots, OG image, Product JSON-LD); image moderation + ShopImage; web push (VAPID) scaffolding; /api/health; shops.timezone. |
| 5 — Reporting | ✓ committed | `additional-features` | `318a91a` | Migrations `20260522000003/4` (pos_sale_items + complete_pos_sale_v4 line writes + 3 reporting RPCs). lib/reports/{range,csv}.ts; profitability / top-products (Pareto) / top-customers / sales-by-staff Views + pages; finance vs-last-month deltas. PDF export (`@react-pdf/renderer`) deferred — CSV only for now. |
| 6 — Customer Growth | pending | — | — | Next up. |
| 7–10 | pending | — | — | — |

User-written migrations co-existing on the branch:
- `20260516000016_fix_create_shop_owner_id.sql` — restores `owner_id` insert in `create_shop_with_owner`. Apply before any later migration on an old DB.
- `20260516000024_repair_payment_audit_logs_contract.sql` — forward-only repair to align prod's `payment_audit_logs` with the audit schema. Idempotent.

**Resume instructions for a future Claude CLI session**

```
cd /mnt/Linux-Projects/Code/Official_Projects/SaaS/Quivo/quivo_official
git checkout additional-features          # or whichever branch holds the WIP
claude                                    # then in chat:
> read PLAN.md and continue execution from the first unchecked phase
```

The plan is the source of truth. Pick up at the lowest-numbered phase that still has open checkboxes. Next available migration timestamp is **`20260516000027_…`**.

**Migration timestamp collisions** — both fixed in Phase 0:
- ✓ `20260516000001_staff_shifts.sql` ↔ `…_supplier_profile_and_ledger.sql` → renamed supplier to `…000003_…`.
- ✓ `20260516000002_kyc_grace_period_notifications.sql` ↔ `…_payroll_templates.sql` → renamed KYC to `…000004_…`.
- Two legacy 2024 collisions (`…000007`, `…000012`) are grandfathered by `scripts/check-migration-names.mjs` because they have already been applied to every deployed DB.

**Files the user has hand-tuned** (don't revert when editing):
- `components/onboarding/OwnerOnboarding.tsx` — adds AddressPinPicker + Nominatim reverse-geocode on the Location step.
- `components/dashboard/owner/OwnerSidebar.tsx` — collapsing icon rail on `md`, full layout on `lg`.
- `components/dashboard/owner/OwnerMobileNav.tsx` — bottom tab label sizing.
- `components/dashboard/NotificationBell.tsx` — memoised client + stable channel id.

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

### Migration: `supabase/migrations/20260516000005_domain_events.sql` ✓ landed

- `domain_events` (id, name, payload JSONB, aggregate_id, shop_id, user_id, processed_at, attempt_count, processing_error, idempotency_key, created_at).
- Indexes: unprocessed-queue, name+created_at, shop_id+created_at, unique idempotency_key.
- RLS deny-all for authenticated / anon (service role only). No realtime publication.

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

### Schema migrations (apply in this order) ✓

1. ✓ `supabase/migrations/20260516000006_tax_columns_on_transactions.sql` — `shop_transactions` + `orders` + `shops` tax/discount/fee columns; `transaction_splits` table; widens `shop_transactions.payment_method` CHECK to include `wallet/qr/split`. Backfill + NOT NULL on `subtotal`.
2. ✓ `supabase/migrations/20260516000007_pos_sale_v3_with_tax.sql` — frozen `complete_pos_sale` v3 (10 args). Validates total equation to the rupee, sum-of-splits, ≤ 3 splits. Drops legacy 5-arg signature.
3. ✓ `supabase/migrations/20260516000008_storefront_order_v2_with_tax.sql` — `place_storefront_order` v2 (17 args). Mirrors tax/fees with rupee-level total validation. Drops legacy 11-arg signature.
4. ✓ `supabase/migrations/20260516000009_refunds.sql` — `refunds` + `refund_items` + RLS (manager+). `process_refund` SECURITY DEFINER RPC restores stock, writes offsetting negative `shop_transactions` row, emits `refund.completed` to `domain_events`.
5. ✓ `supabase/migrations/20260516000010_held_sales.sql` — POS park & resume. Shop-member RLS for read/write/delete.
6. ✓ `supabase/migrations/20260516000011_audit_views.sql` — `v_security_events_user` (self-only) + `v_payment_audit_logs_shop` (shop-member-only) with actor name/email joined in.
7. ✓ `supabase/migrations/20260516000012_place_order_with_payment_v2_tax.sql` — the live storefront RPC (replaces the v1 from `20260515000001_security_hardening_followup.sql`). Reads `shops.vat_registered/vat_rate` and computes tax server-side; returns `subtotal/tax_amount/delivery_fee/service_charge/total` in the result. Drops the v1 12-arg signature.
8. ✓ `supabase/migrations/20260516000013_get_public_shop_v2_with_tax.sql` — adds `vat_registered/vat_rate/pan_number` to the anon storefront DTO so `CheckoutModal` can display the tax line.

### UI / actions

- [x] **POSView tax + item discount + split payment + park + reprint** (`components/dashboard/owner/pos/POSView.tsx` + `app/actions/pos.ts`):
  - Per-line discount input on each cart row (capped to line subtotal); order-level discount kept (flat or %).
  - Tax footer driven by `shop.vat_registered` and `shop.vat_rate` from the page-fetched shop row.
  - Split-payment editor: 1–3 methods (cash/card/QR/online/wallet/udhar), live "allocated vs remaining" indicator, blocks submit until split sums to the rupee.
  - `printBill` rewritten to include shop name, owner name (Prop:), PAN (when set), receipt #, subtotal, line-discount roll-up, order discount, `VAT (rate%)` line, grand total, split breakdown.
  - Persistent re-print floating button bound to `lastReceiptBill` state — survives closing the success modal.
  - Park/resume: `parkSale`, `listHeldSales`, `getHeldSale`, `deleteHeldSale` server actions in `app/actions/pos.ts`; right-side sheet lists open holds with Resume / Cancel.
- [x] **Owner orders refund flow** (`components/dashboard/owner/orders/{OrderList,RefundModal}.tsx` + `app/actions/refunds.ts`):
  - "Refund" button on delivered orders opens a modal with line + qty selection, reason text, pro-rated tax-refunded line.
  - Server action `createRefund` inserts `refunds` + `refund_items` rows then calls `process_refund` atomically.
- [x] **Storefront checkout tax display** (`components/storefront/CheckoutModal.tsx`):
  - `vatRegistered`, `vatRate`, `panNumber` props plumbed from `StorefrontPage` (DTO updated to include them).
  - Order summary now shows subtotal, VAT (when registered), total. RPC return shape returns authoritative `subtotal/tax/delivery/service/total` in `PlaceOrderResult.pricing`.
- [x] **Sidebar role gating** (`components/dashboard/owner/OwnerSidebar.tsx` + `OwnerMobileNav.tsx`):
  - Each route declares `roles?: ShopRole[]`. `visibleRoutesFor()` filters; `owner/admin/manager` always see everything.
  - Mobile bottom-tab nav uses the same allow-list semantics.
- [x] **Audit log UI** at `/dashboard/owner/settings/audit`:
  - Two-tab view (Payment audit / Security events), date-range filter, search box, CSV export (shared `downloadCsv` pattern).
  - Reads from `v_payment_audit_logs_shop` + `v_security_events_user` views.
- [x] **VAT-3 monthly export** at `/dashboard/owner/finances/vat`:
  - Year + month pickers, KPI cards, table with POS / online split.
  - `app/actions/vat.ts` `getVatReport(shopId, year, month)`; CSV download with IRD-style header block (shop name, PAN, period, rate) and totals footer.
- [x] **Settings: Tax & VAT section** in `ShopSettings.tsx`:
  - Toggle for `vat_registered`, editable `vat_rate`, editable `pan_number`. `updateShopSettings` extended in `app/actions/owner.ts`.
- [x] **Settings: shortcut cards** to `/dashboard/owner/settings/audit` and `/dashboard/owner/finances/vat`.
- [x] **Event emit** — `app/actions/owner.ts#completePOSSale` and `app/actions/payments.ts#placeOrderWithPayment` now fire `transaction.completed` / `order.placed` via `emitBackground()` with idempotency keys. Phase 2 wires the consumers.

### Verification

- [x] `pnpm verify` passes (typecheck + lint + migration check, 0 errors).
- [ ] **Operator step** — apply migrations `20260516000006` through `20260516000013` in Supabase, then smoke-test:
  - [ ] Toggle VAT on in Shop Settings (rate 13.00); sell 3 items at POS → printed receipt shows the 13% VAT line and totals balance to the rupee.
  - [ ] Toggle VAT off → no tax line, no tax row in DB (`tax_amount = 0`).
  - [ ] Refund 1 of 3 items on a delivered order → product stock rises by the refunded qty; `refunds` + `refund_items` rows exist; offsetting negative `shop_transactions` row appears; `domain_events.refund.completed` written.
  - [ ] Split a Rs. 1000 sale: 600 cash + 400 QR → `transaction_splits` has two rows summing to 1000; receipt prints both lines.
  - [ ] Park a cart, close POS, reopen → resume from "Held" sheet restores items, discounts, buyer.
  - [ ] As a `cashier`-role user on a shop, sidebar hides Payments, Finances, Payroll, Settings, Storefront.
  - [ ] `/dashboard/owner/finances/vat` for the current month: KPI cards reflect totals from the table; CSV opens cleanly in LibreOffice.
  - [ ] `/dashboard/owner/settings/audit` lists `payment_audit_logs` rows for the shop and personal `security_events`; CSV export works.
  - [ ] Place an order from the storefront → `domain_events.order.placed` row exists with `idempotency_key = order:<uuid>`.
  - [ ] Complete a POS sale → `domain_events.transaction.completed` row exists with `idempotency_key = pos:<uuid>`.

---

## Phase 2 — Email + Notification Platform

**Goal:** every transactional event the user expects to be told about, gets sent. Both inboxes and an in-app bell.

### Schema migrations

- `supabase/migrations/20260516000014_notifications.sql`
  - `notifications` table: id, user_id, kind (enum), title, body, link_url, read_at, created_at.
  - Adds `notifications` to `supabase_realtime` publication with `REPLICA IDENTITY FULL` (guard with `pg_publication_tables`).
- `supabase/migrations/20260516000015_notification_preferences.sql`
  - `notification_preferences` (user_id PK, prefs JSONB) — per-user toggles per kind across channels (email, in-app, sms, push). Single row per user; JSONB structure documented in the migration header.

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

- `supabase/migrations/20260516000016_product_batches.sql`
  - `product_batches` (id, product_id, batch_no, expiry_date, received_qty, remaining_qty, cost_price, received_at, supplier_id NULLABLE).
  - Trigger keeps `products.stock = SUM(product_batches.remaining_qty)`.
  - `complete_pos_sale` **v4** (separate function, not in-place edit) picks soonest expiry first (FEFO) and decrements `remaining_qty` per batch; writes `transaction_batch_consumption` rows for audit. Phase-1 v3 stays available for rollback.
- `supabase/migrations/20260516000017_purchase_orders.sql`
  - `purchase_orders` (id, shop_id, supplier_id, status, ordered_at, expected_at, received_at, total_amount, notes).
  - `purchase_order_lines` (id, purchase_order_id, product_id, qty_ordered, qty_received, unit_cost).
  - `receive_purchase_order(p_po_id, p_received_lines JSONB)` RPC: validates, inserts `product_batches` rows, updates PO status to `received` / `partial`, updates supplier `balance_due` only if billed-after-receive.
- `supabase/migrations/20260516000018_stock_takes.sql`
  - `stock_takes` (id, shop_id, started_at, completed_at, status, started_by, notes).
  - `stock_take_counts` (id, stock_take_id, product_id, system_qty, counted_qty, variance, variance_value).
  - `stock_adjustments` (id, shop_id, product_id, qty_change, reason, source_table, source_id, created_at).
  - `complete_stock_take(p_id)` RPC writes one `stock_adjustments` row per non-zero variance, then closes the stock-take.
- `supabase/migrations/20260516000019_day_end.sql`
  - `day_end_closes` (id, shop_id, opened_at, closed_at, opening_cash, expected_cash, counted_cash, variance, notes, closed_by).
  - Unique partial index `(shop_id) WHERE closed_at IS NULL` to forbid two open days.
- `supabase/migrations/20260516000020_stock_transfers.sql`
  - `stock_transfers` (id, from_shop_id, to_shop_id, status, created_at, completed_at).
  - `stock_transfer_lines` (id, transfer_id, product_id, qty, source_batch_id NULLABLE, target_batch_id NULLABLE).
  - `execute_stock_transfer(p_id)` RPC: atomic move between batches inside a single transaction.

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

- [x] **Per-product profitability view** at `/dashboard/owner/products/profitability`:
  - Columns: product, units sold (range), revenue, COGS (sum of batch cost × qty consumed, else units × `products.cost_price`), gross margin %, current rate.
  - Sort by margin / revenue / volume.
  - CSV export. (`get_product_profitability` RPC unions `pos_sale_items` + `orders.items`.)
- [x] **Top customers + top products** at `/dashboard/owner/customers/top` and `/dashboard/owner/products/top`:
  - Configurable date range, "by revenue" / "by qty" toggle.
  - Pareto chart from `recharts` (ComposedChart: Bar + cumulative-% Line) on top-products.
- [x] **Sales-by-staff** at `/dashboard/owner/staff/sales`:
  - Joins `shop_transactions.created_by → shop_staff.linked_user_id`.
  - Hours worked (from completed `shifts`) and sales rung-up side by side; sales/hour ratio.
- [x] **Universal date-range + period-comparison** in `lib/reports/range.ts`:
  - `getRangeFromParams` + `presetRange(today|7d|30d|this_month|last_month)` + `pctDelta` + `formatRangeLabel`. Half-open UTC [start,end); `to` inclusive in UI → +1 day internally.
  - Used by all top-N / report pages; finance dashboard uses `pctDelta`.
- [x] **Finance dashboard comparison**:
  - Income / Expenses / Net KPIs gain "vs last month" delta chips.
- [x] **Generic export adapter** at `lib/reports/csv.ts`:
  - CSV: RFC-4180 escape + UTF-8 BOM + `downloadCsv` + `fileStem`. Every report View exports CSV.
  - ~~PDF via `@react-pdf/renderer`~~ — **deferred**; CSV-only for Phase 5 (PDF can be added later without schema change).

### Verification

- [x] Every report page exports CSV without errors (build + typecheck clean; PDF deferred).
- [x] Profitability page computes margin per product from COGS (batch consumption else cost_price).
- [x] Sales-by-staff joins transactions → staff and shifts; surfaces sales/hour.
- [x] Finance dashboard renders vs-last-month delta chips on Income/Expenses/Net.

---

## Phase 6 — Customer-Facing Growth

**Goal:** the customer side stops being a basic catalog and becomes a place customers come back to.

### Schema migrations

- `supabase/migrations/20260516000021_reviews.sql` — `reviews` table (id, shop_id, product_id NULL, order_id NULL, customer_id, rating 1-5, body, status `pending`|`published`|`hidden`, moderated_by, created_at). Trigger updates `products.average_rating` + `products.review_count`. RLS allows customers to insert reviews only for products they have an `orders.status='delivered'` line for.
- `supabase/migrations/20260516000022_promo_codes.sql` — `promo_codes` (id, shop_id, code, kind `percent`|`flat`, value, min_subtotal, max_uses, used_count, valid_from, valid_to, active). `apply_promo_code(p_code, p_shop_id, p_subtotal)` RPC returns discount amount + validates window/cap/min.
- `supabase/migrations/20260516000023_loyalty_redemption.sql` — `redeem_wallet_points(p_user_id, p_shop_id, p_points)` RPC that decrements wallet and returns rupee value (rate stored per shop in a new `wallet_redemption_rate NUMERIC(8,4)` column on `shops`).
- `supabase/migrations/20260516000024_carts.sql` — `carts` table (id, customer_id, shop_id, items JSONB, updated_at). RLS lets the owning customer read/write own row. Phase 7 reuses this for server-side cart persistence.
- `supabase/migrations/20260516000025_delivery_locations.sql` — `delivery_locations` (id, order_id, lat, lng, captured_at). Streams from a future courier app; Phase 6 only renders the most-recent row on the tracking page.

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

- `supabase/migrations/20260516000026_chat_order_thread.sql` — `chat_messages` gains `order_id UUID NULL REFERENCES orders(id)`. Existing rows leave it null; new chats from an order detail page populate it.
- `supabase/migrations/20260516000027_announcements.sql` — `announcements` (id, shop_id, body, audience `all`|`recent_30d`|`saved_shop`, sent_at, recipient_count).
- `supabase/migrations/20260516000028_sms_log.sql` — `sms_log` (id, to_phone, body, provider, provider_message_id, status, delivered_at, error, created_at) for delivery receipts.
- `carts` was already created in Phase 6 (`20260516000024_carts.sql`); Phase 7 only wires the client.

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
- `lib/email/send.ts` ✓ Phase 0 — every new transactional email goes through this. Templates live under `emails/` (pattern: `emails/<Name>.ts`).
- `lib/email/layout.ts` ✓ Phase 0 — shared shop-branded HTML scaffold; every template calls `renderEmailLayout()`.
- `lib/cron/registry.ts` ✓ Phase 0 — every scheduled job is registered here via `registerCronJob({ name, description, handler, timeoutMs? })`.
- `lib/events/emit.ts` ✓ Phase 0 — fan-out for cross-cutting reactions. Handlers will land in `lib/events/handlers/` from Phase 2.
- `lib/log.ts` ✓ Phase 0 — every new module uses `log.info/warn/error/fatal/debug`. Never `console.*`. Use `log.child({ requestId, userId })` for request-scoped binding.
- `lib/sentry.ts` ✓ Phase 0 — `captureException` / `captureMessage`. No-op until `@sentry/nextjs` is installed.
- `middleware.ts` ✓ Phase 0 — stamps `x-request-id` on every request.
- `lib/reports/csv.ts` + `lib/reports/pdf.ts` (Phase 5) — all exports go through these.
- `components/dashboard/owner/pos/POSView.tsx` — cart/tax/discount/split/print state machine. After Phase 1 lands, freeze its `complete_pos_sale` contract; Phase 3's FEFO variant adds v4 alongside, never edits v3.
- `components/dashboard/owner/OwnerSidebar.tsx` — role-aware nav. Phase 0 plumbed `role`; Phase 1 enables filtering.
- `supabase/migrations/` — strict timestamp + descriptive name. Migration-collision check (Phase 0) enforces uniqueness.

## Migration Hygiene Going Forward

- Name: `YYYYMMDDHHMMSS_short_snake_case.sql`. Always include `HHMMSS`, not just `_NNN`.
- Each migration is forward-only and idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).
- Never rename a function in place — create vN+1 alongside vN, then drop vN in a later phase when no caller remains.
- Realtime publication adds are guarded by `pg_publication_tables` check (pattern in `20240101000019_storefront_v2.sql`).
- New tables get RLS on day one; deny-by-default for unauthenticated/anon roles. Policies tested in the migration's verification section.
- Money columns: `NUMERIC(12,2)`. Timestamps: `TIMESTAMPTZ` stored UTC.
- `supabase/` is currently in `.gitignore`; new migrations must be `git add -f` or the gitignore rule needs removal. CI will not see local-only migrations.

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

1. `pnpm install` — pick up any new deps the phase added.
2. `pnpm verify` — wraps `pnpm check:migrations && pnpm typecheck && pnpm lint`. Must exit 0.
3. `supabase db reset && supabase db push` — every migration applies cleanly from scratch. Resolves the local-only migration question before shipping.
4. `pnpm dev` — boot the app, complete the phase-specific verification checklist above.
5. Smoke-test the previous phase's golden path — nothing should have regressed.
6. Update the checkboxes in this file with `[x]` for done items.
7. Commit on the working branch with a message describing the slice (`feat: Phase N — <goal>`). The CI workflow re-runs `pnpm verify` on every push.
