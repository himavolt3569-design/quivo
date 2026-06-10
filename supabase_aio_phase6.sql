-- Phase 6: customer reviews + ratings.
--
-- A review is always tied to a product AND the order through which the
-- customer received it, so we can prove purchase-then-review (the RLS
-- check + the submit RPC both verify the order is the caller's and is
-- in a delivered state). One review per (customer, product, order).
--
-- products.average_rating + review_count are maintained by a trigger so
-- the storefront product card can render stars without a join.
--
-- Status flow: pending → published (default policy is auto-publish, but
-- the owner moderation UI can set hidden retroactively).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count   INTEGER NOT NULL DEFAULT 0;

-- ─── reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'published'
                 CHECK (status IN ('pending', 'published', 'hidden')),
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (customer_id, product_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_status
  ON public.reviews(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_status
  ON public.reviews(shop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer
  ON public.reviews(customer_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can read published reviews.
DROP POLICY IF EXISTS "reviews: public reads published" ON public.reviews;
CREATE POLICY "reviews: public reads published"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- Owners read all their shop's reviews (including pending/hidden).
DROP POLICY IF EXISTS "reviews: shop members read all" ON public.reviews;
CREATE POLICY "reviews: shop members read all"
  ON public.reviews FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id, auth.uid()));

-- Customers read their own (any status).
DROP POLICY IF EXISTS "reviews: customer reads own" ON public.reviews;
CREATE POLICY "reviews: customer reads own"
  ON public.reviews FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Writes go through SECURITY DEFINER RPCs only.

-- ─── product rating recompute trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public._reviews_recompute_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.product_id, OLD.product_id);
  IF v_pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.products p
     SET average_rating = COALESCE((
           SELECT round(avg(r.rating)::NUMERIC, 2)
             FROM public.reviews r
            WHERE r.product_id = v_pid AND r.status = 'published'
         ), 0),
         review_count = (
           SELECT count(*)
             FROM public.reviews r
            WHERE r.product_id = v_pid AND r.status = 'published'
         )
   WHERE p.id = v_pid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_recompute_rating ON public.reviews;
CREATE TRIGGER trg_reviews_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public._reviews_recompute_product_rating();

-- ─── submit_review RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_review(
  p_order_id   UUID,
  p_product_id UUID,
  p_rating     INTEGER,
  p_body       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_order      public.orders%ROWTYPE;
  v_has_line   BOOLEAN;
  v_review_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating must be 1..5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Only the order's customer (when known) may review. Anonymous orders
  -- (customer_id NULL) cannot be reviewed — there's no auth tie.
  IF v_order.customer_id IS NULL OR v_order.customer_id <> v_uid THEN
    RAISE EXCEPTION 'not your order' USING ERRCODE = '42501';
  END IF;

  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'order not delivered' USING ERRCODE = '22023';
  END IF;

  -- Product must be in the order's items JSONB.
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_order.items) AS li
     WHERE (li->>'id')::UUID = p_product_id
  ) INTO v_has_line;
  IF NOT v_has_line THEN
    RAISE EXCEPTION 'product not in this order' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.reviews (shop_id, product_id, order_id, customer_id, rating, body, status)
  VALUES (v_order.shop_id, p_product_id, p_order_id, v_uid,
          p_rating, NULLIF(left(COALESCE(p_body, ''), 2000), ''),
          'published')
  ON CONFLICT (customer_id, product_id, order_id)
    DO UPDATE SET rating = EXCLUDED.rating,
                  body   = EXCLUDED.body,
                  status = 'published',
                  moderated_by = NULL,
                  moderated_at = NULL
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_review(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_review(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- ─── moderate_review RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.moderate_review(
  p_review_id UUID,
  p_action    TEXT  -- 'publish' | 'hide'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_review public.reviews%ROWTYPE;
  v_role   TEXT;
  v_new    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT role INTO v_role
    FROM public.shop_members
   WHERE shop_id = v_review.shop_id AND user_id = v_uid AND status = 'active';
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','manager') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  v_new := CASE lower(p_action)
    WHEN 'publish' THEN 'published'
    WHEN 'hide'    THEN 'hidden'
    ELSE NULL
  END;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'action must be publish|hide' USING ERRCODE = '22023';
  END IF;

  UPDATE public.reviews
     SET status       = v_new,
         moderated_by = v_uid,
         moderated_at = timezone('utc', now())
   WHERE id = p_review_id;

  RETURN p_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moderate_review(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.moderate_review(UUID, TEXT) TO authenticated;
-- Extend get_product_by_shop_barcode to return rating fields so the
-- storefront product detail page can render stars without a second query.

DROP FUNCTION IF EXISTS public.get_product_by_shop_barcode(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_product_by_shop_barcode(
  p_shop_slug TEXT,
  p_barcode   TEXT
)
RETURNS TABLE (
  product_id     UUID,
  shop_id        UUID,
  shop_slug      TEXT,
  shop_name      TEXT,
  name           TEXT,
  brand          TEXT,
  category       TEXT,
  unit           TEXT,
  variant        TEXT,
  description    TEXT,
  price          NUMERIC,
  stock          INTEGER,
  images         TEXT[],
  image_url      TEXT,
  barcode        TEXT,
  is_available   BOOLEAN,
  average_rating NUMERIC,
  review_count   INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id,
    p.shop_id,
    s.slug,
    s.name,
    p.name,
    p.brand,
    p.category,
    p.unit,
    p.variant,
    p.description,
    p.price,
    p.stock,
    p.images,
    p.image_url,
    p.barcode,
    (p.status = 'active' AND s.status = 'active' AND COALESCE(p.stock, 0) > 0) AS is_available,
    COALESCE(p.average_rating, 0)::NUMERIC AS average_rating,
    COALESCE(p.review_count, 0)::INTEGER  AS review_count
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  WHERE p.barcode = p_barcode
    AND s.slug    = p_shop_slug
    AND p.status  = 'active'
    AND s.status  = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_by_shop_barcode(text, text) TO anon, authenticated;
-- Phase 6: typed FK columns on saved_products so back-in-stock and
-- price-drop alerts have a real product reference to compare against.
-- The legacy product_id TEXT column stays for backward compatibility;
-- new code writes to product_uuid + shop_uuid.

ALTER TABLE public.saved_products
  ADD COLUMN IF NOT EXISTS product_uuid   UUID REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shop_uuid      UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS price_at_save  NUMERIC(12, 2);

-- A customer can only have one saved row per (customer, product) on the
-- typed FK once both are populated.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_products_typed
  ON public.saved_products(customer_id, product_uuid)
  WHERE product_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_products_typed_product
  ON public.saved_products(product_uuid)
  WHERE product_uuid IS NOT NULL;
-- Phase 6: promo codes.
--
-- Customer enters a code at checkout; apply_promo_code validates
-- (active window, max_uses, min_subtotal) and returns the discount
-- amount. The order RPC (v4, separate migration) records the code
-- on the order and atomically increments used_count.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('percent', 'flat')),
  value         NUMERIC(12, 2) NOT NULL CHECK (value > 0),
  min_subtotal  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount  NUMERIC(12, 2),  -- caps a percent code
  max_uses      INTEGER,
  used_count    INTEGER NOT NULL DEFAULT 0,
  valid_from    TIMESTAMPTZ,
  valid_to      TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (shop_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_shop
  ON public.promo_codes(shop_id, active);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes: members read" ON public.promo_codes;
CREATE POLICY "promo_codes: members read"
  ON public.promo_codes FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id, auth.uid()));

DROP POLICY IF EXISTS "promo_codes: managers write" ON public.promo_codes;
CREATE POLICY "promo_codes: managers write"
  ON public.promo_codes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shop_members
             WHERE shop_id = promo_codes.shop_id
               AND user_id = auth.uid()
               AND status  = 'active'
               AND role    IN ('owner','admin','manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shop_members
             WHERE shop_id = promo_codes.shop_id
               AND user_id = auth.uid()
               AND status  = 'active'
               AND role    IN ('owner','admin','manager'))
  );

-- Record promo on orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code_id   UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code      TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount  NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- ─── apply_promo_code RPC ──────────────────────────────────────────────────
-- Pure validator: returns the discount + the promo id. Anyone can call it
-- (anon checkouts need to preview the discount); the actual increment of
-- used_count happens atomically inside the order RPC.
CREATE OR REPLACE FUNCTION public.apply_promo_code(
  p_shop_id  UUID,
  p_code     TEXT,
  p_subtotal NUMERIC
)
RETURNS TABLE (promo_id UUID, code TEXT, discount NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row      public.promo_codes%ROWTYPE;
  v_discount NUMERIC;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'CODE_EMPTY';
  END IF;
  IF COALESCE(p_subtotal, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_SUBTOTAL';
  END IF;

  SELECT * INTO v_row
    FROM public.promo_codes
   WHERE shop_id = p_shop_id
     AND upper(code) = upper(trim(p_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;
  IF NOT v_row.active THEN
    RAISE EXCEPTION 'CODE_INACTIVE';
  END IF;
  IF v_row.valid_from IS NOT NULL AND timezone('utc', now()) < v_row.valid_from THEN
    RAISE EXCEPTION 'CODE_NOT_YET_VALID';
  END IF;
  IF v_row.valid_to IS NOT NULL AND timezone('utc', now()) > v_row.valid_to THEN
    RAISE EXCEPTION 'CODE_EXPIRED';
  END IF;
  IF v_row.max_uses IS NOT NULL AND v_row.used_count >= v_row.max_uses THEN
    RAISE EXCEPTION 'CODE_USED_UP';
  END IF;
  IF p_subtotal < v_row.min_subtotal THEN
    RAISE EXCEPTION 'MIN_SUBTOTAL:%', v_row.min_subtotal;
  END IF;

  v_discount := CASE v_row.kind
    WHEN 'percent' THEN round((p_subtotal * v_row.value) / 100, 2)
    WHEN 'flat'    THEN round(v_row.value, 2)
  END;
  IF v_row.max_discount IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_row.max_discount);
  END IF;
  v_discount := LEAST(v_discount, p_subtotal);

  RETURN QUERY SELECT v_row.id, v_row.code, v_discount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_promo_code(UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.apply_promo_code(UUID, TEXT, NUMERIC) TO anon, authenticated;
-- Phase 6: wallet redemption at checkout.
--
-- The existing system tracks wallet balance in rupees (profiles.wallet_balance)
-- and ledger entries in wallet_transactions(credit|debit). Loyalty
-- redemption deducts from wallet_balance up to a configurable per-shop
-- cap (max_wallet_redeem_pct of subtotal) and records the used amount on
-- the order. The actual decrement happens inside place_order_with_payment
-- v4 so it stays atomic with the order.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS max_wallet_redeem_pct NUMERIC(5, 2) NOT NULL DEFAULT 20.00
    CHECK (max_wallet_redeem_pct BETWEEN 0 AND 100);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_used NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (wallet_used >= 0);

-- Read-only helper for the checkout UI to know the max it can redeem.
CREATE OR REPLACE FUNCTION public.get_wallet_redeem_max(
  p_shop_id  UUID,
  p_subtotal NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_bal    NUMERIC := 0;
  v_pct    NUMERIC := 20;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(wallet_balance, 0) INTO v_bal FROM public.profiles WHERE id = v_uid;
  SELECT COALESCE(max_wallet_redeem_pct, 0) INTO v_pct FROM public.shops WHERE id = p_shop_id;
  RETURN round(LEAST(v_bal, (COALESCE(p_subtotal, 0) * v_pct) / 100), 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_wallet_redeem_max(UUID, NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_wallet_redeem_max(UUID, NUMERIC) TO authenticated;
-- Phase 6: place_order_with_payment v4 — adds promo code + wallet
-- redemption + atomic ledger writes. Drops the v3 (16-arg) signature.
--
-- Calculation order:
--   subtotal − promo_discount → discounted_subtotal
--   discounted_subtotal − wallet_used → after_wallet
--   after_wallet + delivery_fee + service_charge + VAT(after_wallet+service)
--   = total
--
-- Constraints:
--   wallet_used capped by min(profiles.wallet_balance,
--                             shops.max_wallet_redeem_pct × discounted_subtotal / 100).
--   Anonymous callers cannot redeem the wallet (no profile).

DROP FUNCTION IF EXISTS public.place_order_with_payment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION
);

CREATE OR REPLACE FUNCTION public.place_order_with_payment(
  p_shop_id               UUID,
  p_shop_name             TEXT,
  p_order_number          TEXT,
  p_customer_name         TEXT,
  p_customer_phone        TEXT,
  p_customer_email        TEXT,
  p_delivery_address      TEXT,
  p_items                 JSONB,
  p_total_amount          NUMERIC,
  p_payment_method        TEXT,
  p_transaction_reference TEXT,
  p_notes                 TEXT DEFAULT NULL,
  p_delivery_fee          NUMERIC DEFAULT 0,
  p_service_charge        NUMERIC DEFAULT 0,
  p_delivery_lat          DOUBLE PRECISION DEFAULT NULL,
  p_delivery_lng          DOUBLE PRECISION DEFAULT NULL,
  p_promo_code            TEXT DEFAULT NULL,
  p_wallet_used           NUMERIC DEFAULT 0
) RETURNS TABLE (
  order_id       UUID,
  payment_id     UUID,
  order_number   TEXT,
  tracking_token TEXT,
  subtotal       NUMERIC,
  promo_discount NUMERIC,
  wallet_used    NUMERIC,
  tax_amount     NUMERIC,
  delivery_fee   NUMERIC,
  service_charge NUMERIC,
  total_amount   NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id           UUID;
  v_payment_id         UUID;
  v_tracking_token     TEXT;
  v_line               RECORD;
  v_product            RECORD;
  v_enabled            TEXT[];
  v_payment_status     TEXT;
  v_subtotal           NUMERIC := 0;
  v_promo              RECORD;
  v_promo_id           UUID := NULL;
  v_promo_code         TEXT := NULL;
  v_promo_discount     NUMERIC := 0;
  v_discounted_sub     NUMERIC := 0;
  v_wallet_used        NUMERIC := 0;
  v_wallet_balance     NUMERIC := 0;
  v_wallet_cap_pct     NUMERIC := 0;
  v_wallet_max         NUMERIC := 0;
  v_after_wallet       NUMERIC := 0;
  v_tax_amount         NUMERIC := 0;
  v_tax_rate           NUMERIC := 0;
  v_vat_registered     BOOLEAN := false;
  v_delivery_fee       NUMERIC := 0;
  v_service_charge     NUMERIC := 0;
  v_total              NUMERIC := 0;
  v_items              JSONB   := '[]'::jsonb;
  v_shop_name          TEXT;
  v_customer_id        UUID := auth.uid();
BEGIN
  SELECT name, COALESCE(vat_registered, false), COALESCE(vat_rate, 0),
         COALESCE(max_wallet_redeem_pct, 0)
    INTO v_shop_name, v_vat_registered, v_tax_rate, v_wallet_cap_pct
  FROM public.shops
  WHERE id = p_shop_id AND status = 'active';

  IF v_shop_name IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_CART';
  END IF;

  SELECT COALESCE(enabled_methods, ARRAY['cod']::TEXT[]) INTO v_enabled
  FROM public.shop_payment_configs WHERE shop_id = p_shop_id;
  IF v_enabled IS NULL THEN v_enabled := ARRAY['cod']::TEXT[]; END IF;

  IF NOT (p_payment_method = ANY (v_enabled)) THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_DISABLED:%', p_payment_method;
  END IF;

  v_payment_status := CASE p_payment_method
    WHEN 'cod'           THEN 'cod_pending'
    WHEN 'esewa'         THEN 'payment_initiated'
    WHEN 'khalti'        THEN 'payment_initiated'
    WHEN 'bank_transfer' THEN 'paid_pending_receipt_upload'
    WHEN 'qr_code'       THEN 'paid_pending_receipt_upload'
    ELSE NULL
  END;
  IF v_payment_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  IF (p_delivery_lat IS NULL) <> (p_delivery_lng IS NULL) THEN
    RAISE EXCEPTION 'INVALID_LOCATION';
  END IF;
  IF p_delivery_lat IS NOT NULL AND (p_delivery_lat < -90 OR p_delivery_lat > 90) THEN
    RAISE EXCEPTION 'INVALID_LAT';
  END IF;
  IF p_delivery_lng IS NOT NULL AND (p_delivery_lng < -180 OR p_delivery_lng > 180) THEN
    RAISE EXCEPTION 'INVALID_LNG';
  END IF;

  FOR v_line IN
    SELECT (value->>'id')::UUID AS product_id,
           SUM((value->>'qty')::NUMERIC) AS qty
    FROM jsonb_array_elements(p_items)
    GROUP BY (value->>'id')::UUID
  LOOP
    IF v_line.qty IS NULL OR v_line.qty <= 0 OR v_line.qty > 99 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT id, name, price, stock, images, image_url
      INTO v_product
    FROM public.products
    WHERE id = v_line.product_id
      AND shop_id = p_shop_id
      AND status = 'active'
    FOR UPDATE;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE';
    END IF;
    IF v_product.stock < v_line.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product.name;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_line.qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'qty', v_line.qty,
      'image', COALESCE(v_product.images[1], v_product.image_url)
    ));
  END LOOP;

  v_subtotal       := round(v_subtotal, 2);
  v_delivery_fee   := round(GREATEST(COALESCE(p_delivery_fee, 0),   0), 2);
  v_service_charge := round(GREATEST(COALESCE(p_service_charge, 0), 0), 2);

  -- ─── Promo code ─────────────────────────────────────────────────────────
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo
      FROM public.promo_codes
     WHERE shop_id = p_shop_id
       AND upper(code) = upper(trim(p_promo_code))
       FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CODE_NOT_FOUND'; END IF;
    IF NOT v_promo.active THEN RAISE EXCEPTION 'CODE_INACTIVE'; END IF;
    IF v_promo.valid_from IS NOT NULL AND timezone('utc', now()) < v_promo.valid_from THEN
      RAISE EXCEPTION 'CODE_NOT_YET_VALID'; END IF;
    IF v_promo.valid_to IS NOT NULL AND timezone('utc', now()) > v_promo.valid_to THEN
      RAISE EXCEPTION 'CODE_EXPIRED'; END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
      RAISE EXCEPTION 'CODE_USED_UP'; END IF;
    IF v_subtotal < v_promo.min_subtotal THEN
      RAISE EXCEPTION 'MIN_SUBTOTAL:%', v_promo.min_subtotal; END IF;

    v_promo_discount := CASE v_promo.kind
      WHEN 'percent' THEN round((v_subtotal * v_promo.value) / 100, 2)
      WHEN 'flat'    THEN round(v_promo.value, 2)
    END;
    IF v_promo.max_discount IS NOT NULL THEN
      v_promo_discount := LEAST(v_promo_discount, v_promo.max_discount);
    END IF;
    v_promo_discount := LEAST(v_promo_discount, v_subtotal);
    v_promo_id   := v_promo.id;
    v_promo_code := v_promo.code;
  END IF;

  v_discounted_sub := round(v_subtotal - v_promo_discount, 2);

  -- ─── Wallet redemption ─────────────────────────────────────────────────
  v_wallet_used := round(GREATEST(COALESCE(p_wallet_used, 0), 0), 2);
  IF v_wallet_used > 0 THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'WALLET_REQUIRES_AUTH';
    END IF;
    SELECT COALESCE(wallet_balance, 0) INTO v_wallet_balance
      FROM public.profiles WHERE id = v_customer_id FOR UPDATE;
    v_wallet_max := round(LEAST(v_wallet_balance, (v_discounted_sub * v_wallet_cap_pct) / 100), 2);
    IF v_wallet_used > v_wallet_max THEN
      RAISE EXCEPTION 'WALLET_EXCEEDS_MAX:%', v_wallet_max;
    END IF;
  END IF;

  v_after_wallet := round(v_discounted_sub - v_wallet_used, 2);
  IF v_after_wallet < 0 THEN
    RAISE EXCEPTION 'WALLET_OVERPAY';
  END IF;

  IF v_vat_registered THEN
    v_tax_amount := round(((v_after_wallet + v_service_charge) * v_tax_rate) / 100, 2);
  ELSE
    v_tax_amount := 0;
    v_tax_rate   := 0;
  END IF;

  v_total := round(v_after_wallet + v_service_charge + v_delivery_fee + v_tax_amount, 2);

  IF v_total <= 0 OR v_total > 1000000 THEN
    RAISE EXCEPTION 'INVALID_TOTAL';
  END IF;

  v_tracking_token := public.random_hex(24);

  INSERT INTO public.orders (
    shop_id, shop_name, order_number, tracking_token,
    customer_id, customer_name, customer_phone, customer_email,
    delivery_address, delivery_lat, delivery_lng, items,
    subtotal, discount_amount, tax_rate, tax_amount,
    delivery_fee, service_charge, total_amount,
    payment_method, payment_status, status, notes,
    promo_code_id, promo_code, promo_discount, wallet_used
  ) VALUES (
    p_shop_id, v_shop_name, p_order_number, v_tracking_token,
    v_customer_id, left(p_customer_name, 120), left(p_customer_phone, 40),
    NULLIF(left(COALESCE(p_customer_email, ''), 200), ''),
    left(p_delivery_address, 500), p_delivery_lat, p_delivery_lng, v_items,
    v_subtotal, v_promo_discount, v_tax_rate, v_tax_amount,
    v_delivery_fee, v_service_charge, v_total,
    p_payment_method, v_payment_status, 'placed', NULLIF(left(COALESCE(p_notes, ''), 1000), ''),
    v_promo_id, v_promo_code, v_promo_discount, v_wallet_used
  )
  RETURNING id INTO v_order_id;

  IF v_promo_id IS NOT NULL THEN
    UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = v_promo_id;
  END IF;

  IF v_wallet_used > 0 THEN
    UPDATE public.profiles
       SET wallet_balance = wallet_balance - v_wallet_used
     WHERE id = v_customer_id;
    INSERT INTO public.wallet_transactions (customer_id, amount, type, description)
    VALUES (v_customer_id, v_wallet_used, 'debit',
            'Order ' || p_order_number || ' — wallet redemption');
  END IF;

  INSERT INTO public.payments (
    order_id, shop_id, customer_id,
    payment_method, payment_status, amount, currency, transaction_reference
  ) VALUES (
    v_order_id, p_shop_id, v_customer_id,
    p_payment_method, v_payment_status, v_total, 'NPR', p_transaction_reference
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_audit_logs (payment_id, order_id, shop_id, action, actor_type, to_status, metadata)
  VALUES (v_payment_id, v_order_id, p_shop_id, 'initiated', 'customer', v_payment_status,
          jsonb_build_object(
            'method', p_payment_method,
            'subtotal', v_subtotal,
            'promo_discount', v_promo_discount,
            'wallet_used', v_wallet_used,
            'tax_amount', v_tax_amount,
            'delivery_fee', v_delivery_fee,
            'service_charge', v_service_charge,
            'total', v_total,
            'client_total', p_total_amount,
            'has_coords', (p_delivery_lat IS NOT NULL AND p_delivery_lng IS NOT NULL),
            'authed', (v_customer_id IS NOT NULL)
          ));

  FOR v_line IN
    SELECT (value->>'id')::UUID AS product_id,
           SUM((value->>'qty')::NUMERIC) AS qty
    FROM jsonb_array_elements(p_items)
    GROUP BY (value->>'id')::UUID
  LOOP
    UPDATE public.products
    SET stock = stock - v_line.qty
    WHERE id = v_line.product_id AND shop_id = p_shop_id;
  END LOOP;

  RETURN QUERY SELECT
    v_order_id, v_payment_id, p_order_number, v_tracking_token,
    v_subtotal, v_promo_discount, v_wallet_used, v_tax_amount,
    v_delivery_fee, v_service_charge, v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order_with_payment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_with_payment(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT,
  NUMERIC, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, NUMERIC
) TO anon, authenticated;
-- Phase 6: server-side cart persistence + abandoned-cart recovery.
--
-- One row per (customer, shop). The items array is a thin snapshot —
-- product_id + qty — recomputed on hydrate so price and stock are
-- always current. The abandoned-cart cron emits cart.abandoned for
-- rows untouched for 24h+ that still have items, and clears the row
-- when the matching order is placed.

CREATE TABLE IF NOT EXISTS public.carts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  abandoned_email_sent_at TIMESTAMPTZ,
  UNIQUE (customer_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_customer
  ON public.carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_updated
  ON public.carts(updated_at);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts: owner all" ON public.carts;
CREATE POLICY "carts: owner all"
  ON public.carts FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
-- Phase 6: detection state columns for the wishlist-alerts cron.
ALTER TABLE public.saved_products
  ADD COLUMN IF NOT EXISTS back_in_stock_alerted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_drop_alerted_at    TIMESTAMPTZ;
-- Phase 6: extend the notifications.kind check constraint to allow the
-- three new customer-facing alerts. Append-only — existing values stay.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'transaction.completed',
    'order.placed',
    'order.status_changed',
    'refund.completed',
    'low_stock.detected',
    'kyc.stage_due',
    'cart_abandoned',
    'back_in_stock',
    'price_drop',
    'system'
  ));
-- Phase 6: live delivery location stream.
--
-- One row per courier "ping" for an order. The tracking page reads the
-- latest row to draw a moving marker on the map. A future courier app
-- will be the producer; until then the table is unused.

CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_delivery_locations_order_time
  ON public.delivery_locations(order_id, captured_at DESC);

ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

-- The customer (who owns the order) and any shop member can read pings
-- for that order. Tracking-token only callers go through the RPC below.
DROP POLICY IF EXISTS "deliv_loc: customer reads own" ON public.delivery_locations;
CREATE POLICY "deliv_loc: customer reads own"
  ON public.delivery_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = delivery_locations.order_id
         AND (o.customer_id = auth.uid()
              OR public.is_shop_member(o.shop_id, auth.uid()))
    )
  );

-- Writes via service-role or a future courier RPC.
GRANT INSERT, SELECT ON public.delivery_locations TO service_role;

-- Tracking-token-gated read for the anonymous tracking page.
CREATE OR REPLACE FUNCTION public.get_latest_delivery_location(
  p_order_number   TEXT,
  p_tracking_token TEXT
)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION, captured_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT dl.lat, dl.lng, dl.captured_at
  FROM public.delivery_locations dl
  JOIN public.orders o ON o.id = dl.order_id
  WHERE o.order_number   = p_order_number
    AND o.tracking_token = p_tracking_token
  ORDER BY dl.captured_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_latest_delivery_location(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_latest_delivery_location(TEXT, TEXT) TO anon, authenticated;
-- Up Migration for Wholesale Features

-- 1. Add Wholesale config to shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wholesale_discount_percent NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER DEFAULT 6;

-- 2. Wholesale Applications Table
CREATE TABLE IF NOT EXISTS public.wholesale_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wholesaler_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    retailer_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    override_discount_percent NUMERIC(5,2) DEFAULT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    UNIQUE(wholesaler_shop_id, retailer_shop_id)
);

-- RLS for wholesale_applications
ALTER TABLE public.wholesale_applications ENABLE ROW LEVEL SECURITY;

-- Wholesalers can see their own applications
CREATE POLICY "Wholesalers can view their applications" 
ON public.wholesale_applications FOR SELECT 
TO authenticated 
USING (wholesaler_shop_id IN (
    SELECT shop_id FROM public.shop_staff WHERE linked_user_id = auth.uid()
));

-- Retailers can see their own applications
CREATE POLICY "Retailers can view their applications" 
ON public.wholesale_applications FOR SELECT 
TO authenticated 
USING (retailer_shop_id IN (
    SELECT shop_id FROM public.shop_staff WHERE linked_user_id = auth.uid()
));

-- Retailers can insert an application
CREATE POLICY "Retailers can apply to wholesalers" 
ON public.wholesale_applications FOR INSERT 
TO authenticated 
WITH CHECK (
    retailer_shop_id IN (
        SELECT shop_id FROM public.shop_staff WHERE linked_user_id = auth.uid()
    ) AND status = 'pending'
);

-- Wholesalers can update (approve/reject/override) their applications
CREATE POLICY "Wholesalers can update applications" 
ON public.wholesale_applications FOR UPDATE 
TO authenticated 
USING (
    wholesaler_shop_id IN (
        SELECT shop_id FROM public.shop_staff WHERE linked_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
)
WITH CHECK (
    wholesaler_shop_id IN (
        SELECT shop_id FROM public.shop_staff WHERE linked_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
);

-- Add to Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'wholesale_applications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wholesale_applications;
    END IF;
END
$$;
-- Migration to update get_verified_shops for Wholesale Discovery
CREATE OR REPLACE FUNCTION public.get_verified_shops()
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  slug         TEXT,
  category     TEXT,
  description  TEXT,
  image_url    TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  address      TEXT,
  opening_time TIME,
  closing_time TIME,
  is_wholesale BOOLEAN,
  delivery_radius_km INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    id,
    name,
    slug,
    category,
    description,
    logo_url AS image_url,
    lat,
    lng,
    address,
    opening_time,
    closing_time,
    is_wholesale,
    delivery_radius_km
  FROM public.shops
  WHERE verification_status = 'verified'
    AND status != 'archived'
  ORDER BY name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_verified_shops() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_verified_shops() TO anon, authenticated;
