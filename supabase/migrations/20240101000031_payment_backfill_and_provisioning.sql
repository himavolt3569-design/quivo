-- ─── Milestone P.1: Payment Config Backfill + Auto-Provisioning ──────────────
-- Follow-up to 20240101000030_payment_system.sql.
--
-- Three problems this addresses:
--
--   1. Existing shops created BEFORE the payment system don't have a
--      shop_payment_configs row, so the customer-facing RPC returns NULL and
--      checkout silently falls back to a "cod-only" default that the owner
--      can't see or edit from the dashboard.
--
--   2. New shops created via createShop / RPC also don't get a config row
--      until the owner first saves the settings page — same problem as #1.
--
--   3. The legacy place_storefront_order RPC (from migration 25) bypasses
--      shop_payment_configs entirely.  No app code calls it anymore, but
--      leaving it executable is a production hazard.
--
-- The fix:
--   * Backfill: every shop without a config row gets one with default
--     enabled_methods = ['cod'].  This is idempotent — re-running is safe.
--   * Trigger: AFTER INSERT on shops auto-creates the same default row.
--   * Drop the legacy place_storefront_order function.

-- ─── 1. Backfill existing shops ────────────────────────────────────────────
INSERT INTO public.shop_payment_configs (shop_id, enabled_methods)
SELECT s.id, ARRAY['cod']::TEXT[]
FROM   public.shops s
WHERE  NOT EXISTS (
  SELECT 1 FROM public.shop_payment_configs c WHERE c.shop_id = s.id
);

-- ─── 2. Auto-provision a config row whenever a shop is created ────────────
CREATE OR REPLACE FUNCTION public.tg_shops_seed_payment_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shop_payment_configs (shop_id, enabled_methods)
  VALUES (NEW.id, ARRAY['cod']::TEXT[])
  ON CONFLICT (shop_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_seed_payment_config ON public.shops;
CREATE TRIGGER shops_seed_payment_config
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE PROCEDURE public.tg_shops_seed_payment_config();

-- ─── 3. Retire the legacy place_storefront_order RPC ──────────────────────
-- All app code now goes through place_order_with_payment (migration 30).
-- We DROP rather than REVOKE so any stale client that still tries it gets a
-- clear "function does not exist" error instead of silently writing rows
-- that skip shop_payment_configs validation + audit logging.
DROP FUNCTION IF EXISTS public.place_storefront_order(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT
);
