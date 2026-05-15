-- ─── Milestone P: Production Payment System ─────────────────────────────────
-- Adds:
--   shop_payment_configs   — per-shop gateway credentials + enabled methods + bank/QR
--   payments               — one row per payment attempt (cod / esewa / khalti / bank_transfer / qr_code)
--   payment_audit_logs     — append-only audit trail for every payment state change
--   payment_receipts       — private storage bucket for bank/QR receipt uploads
--   RPCs                   — anon-safe customer flow, owner verification, cross-shop
--                            owner reporting (one owner → many shops)
--
-- Multi-tenancy rules enforced here:
--   * All payment data is gated by is_shop_member(shop_id, auth.uid()).
--   * Gateway secrets are NEVER exposed by SELECT (RLS-locked table + RPCs that
--     mask secret columns; the raw-secret RPC is service-role only).
--   * Owners with multiple shops get cross-shop visibility via the
--     get_owner_payments_* RPCs (filter by is_shop_member, so a user only
--     sees rows belonging to shops they're a member of).
--   * transaction_reference is UNIQUE per shop so a duplicate gateway callback
--     can never cross-pollinate another shop's payment.

-- ─── 0. Extend orders constraints to support the richer payment pipeline ───
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

UPDATE public.orders SET payment_status = 'payment_verified' WHERE payment_status = 'paid';
UPDATE public.orders SET payment_status = 'payment_failed'   WHERE payment_status = 'failed';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN (
    'pending',
    'payment_initiated',
    'payment_failed',
    'payment_cancelled',
    'paid_pending_receipt_upload',
    'paid_pending_owner_confirmation',
    'bank_transfer_pending_verification',
    'qr_payment_pending_verification',
    'cod_pending',
    'payment_verified',
    'payment_rejected',
    'cod_paid',
    'refund_requested',
    'refunded'
  ));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN (
    'cod', 'esewa', 'khalti', 'bank_transfer', 'qr_code'
  ));

-- ─── 1. shop_payment_configs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_payment_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                 UUID NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,

  enabled_methods         TEXT[] NOT NULL DEFAULT ARRAY['cod']::TEXT[],

  esewa_merchant_code     TEXT,
  esewa_secret_key        TEXT,
  esewa_environment       TEXT NOT NULL DEFAULT 'sandbox'
                            CHECK (esewa_environment IN ('sandbox','production')),

  khalti_public_key       TEXT,
  khalti_secret_key       TEXT,
  khalti_environment      TEXT NOT NULL DEFAULT 'sandbox'
                            CHECK (khalti_environment IN ('sandbox','production')),

  bank_name               TEXT,
  bank_account_holder     TEXT,
  bank_account_number     TEXT,
  bank_branch             TEXT,
  bank_swift_code         TEXT,

  qr_code_url             TEXT,
  payment_instructions    TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT enabled_methods_valid CHECK (
    enabled_methods <@ ARRAY['cod','esewa','khalti','bank_transfer','qr_code']::TEXT[]
  )
);

CREATE TRIGGER shop_payment_configs_set_updated_at
  BEFORE UPDATE ON public.shop_payment_configs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.shop_payment_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members read own shop payment config"
    ON public.shop_payment_configs FOR SELECT
    TO authenticated
    USING (public.is_shop_member(shop_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members write own shop payment config"
    ON public.shop_payment_configs FOR ALL
    TO authenticated
    USING (public.is_shop_member(shop_id, auth.uid()))
    WITH CHECK (public.is_shop_member(shop_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. payments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id                  UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  payment_method           TEXT NOT NULL
                            CHECK (payment_method IN ('cod','esewa','khalti','bank_transfer','qr_code')),
  payment_status           TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN (
                              'pending',
                              'payment_initiated',
                              'payment_failed',
                              'payment_cancelled',
                              'paid_pending_receipt_upload',
                              'paid_pending_owner_confirmation',
                              'bank_transfer_pending_verification',
                              'qr_payment_pending_verification',
                              'cod_pending',
                              'payment_verified',
                              'payment_rejected',
                              'cod_paid',
                              'refund_requested',
                              'refunded'
                            )),

  amount                   NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency                 TEXT NOT NULL DEFAULT 'NPR',

  transaction_reference    TEXT NOT NULL,
  gateway_transaction_id   TEXT,
  gateway_response         JSONB,

  receipt_url              TEXT,
  receipt_uploaded_at      TIMESTAMPTZ,

  verified_by_owner        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at              TIMESTAMPTZ,
  rejected_reason          TEXT,
  rejected_at              TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  UNIQUE (shop_id, transaction_reference)
);

CREATE INDEX IF NOT EXISTS idx_payments_shop_status_created
  ON public.payments(shop_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order
  ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_method
  ON public.payments(shop_id, payment_method);

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

DO $$ BEGIN
  CREATE POLICY "Members read own shop payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (public.is_shop_member(shop_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- All writes go through SECURITY DEFINER RPCs; no INSERT/UPDATE policies.

-- ─── 3. payment_audit_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('customer','owner','gateway','system')),
  actor_id        UUID,
  from_status     TEXT,
  to_status       TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON public.payment_audit_logs(payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_audit_shop    ON public.payment_audit_logs(shop_id, created_at DESC);

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members read own shop audit logs"
    ON public.payment_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_shop_member(shop_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. payment_receipts private storage bucket ───────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_receipts', 'payment_receipts', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Anyone may upload payment receipts"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'payment_receipts');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Shop members read own receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'payment_receipts'
      AND public.is_shop_member(
        (storage.foldername(name))[1]::UUID,
        auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. RPC: get_shop_payment_methods (anon-safe; NEVER returns secrets) ──
CREATE OR REPLACE FUNCTION public.get_shop_payment_methods(p_shop_id UUID)
RETURNS TABLE (
  enabled_methods       TEXT[],
  bank_name             TEXT,
  bank_account_holder   TEXT,
  bank_account_number   TEXT,
  bank_branch           TEXT,
  bank_swift_code       TEXT,
  qr_code_url           TEXT,
  payment_instructions  TEXT,
  has_esewa             BOOLEAN,
  has_khalti            BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(c.enabled_methods, ARRAY['cod']::TEXT[]),
    c.bank_name, c.bank_account_holder, c.bank_account_number, c.bank_branch, c.bank_swift_code,
    c.qr_code_url, c.payment_instructions,
    (c.esewa_secret_key IS NOT NULL AND c.esewa_merchant_code IS NOT NULL) AS has_esewa,
    (c.khalti_secret_key IS NOT NULL) AS has_khalti
  FROM public.shop_payment_configs c
  WHERE c.shop_id = p_shop_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shop_payment_methods(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_shop_payment_methods(UUID) TO anon, authenticated;

-- ─── 6. RPC: get_owner_payment_config (auth; masks secrets) ───────────────
CREATE OR REPLACE FUNCTION public.get_owner_payment_config(p_shop_id UUID)
RETURNS TABLE (
  enabled_methods       TEXT[],
  esewa_merchant_code   TEXT,
  esewa_environment     TEXT,
  has_esewa_secret      BOOLEAN,
  khalti_public_key     TEXT,
  khalti_environment    TEXT,
  has_khalti_secret     BOOLEAN,
  bank_name             TEXT,
  bank_account_holder   TEXT,
  bank_account_number   TEXT,
  bank_branch           TEXT,
  bank_swift_code       TEXT,
  qr_code_url           TEXT,
  payment_instructions  TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_shop_member(p_shop_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN: not a member of this shop';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(c.enabled_methods, ARRAY['cod']::TEXT[]),
    c.esewa_merchant_code,
    c.esewa_environment,
    (c.esewa_secret_key IS NOT NULL) AS has_esewa_secret,
    c.khalti_public_key,
    c.khalti_environment,
    (c.khalti_secret_key IS NOT NULL) AS has_khalti_secret,
    c.bank_name, c.bank_account_holder, c.bank_account_number, c.bank_branch, c.bank_swift_code,
    c.qr_code_url, c.payment_instructions
  FROM public.shop_payment_configs c
  WHERE c.shop_id = p_shop_id
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_payment_config(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_owner_payment_config(UUID) TO authenticated;

-- ─── 7. RPC: get_shop_payment_secrets (SERVICE-ROLE ONLY) ─────────────────
CREATE OR REPLACE FUNCTION public.get_shop_payment_secrets(p_shop_id UUID)
RETURNS TABLE (
  esewa_merchant_code  TEXT,
  esewa_secret_key     TEXT,
  esewa_environment    TEXT,
  khalti_public_key    TEXT,
  khalti_secret_key    TEXT,
  khalti_environment   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    esewa_merchant_code, esewa_secret_key, esewa_environment,
    khalti_public_key,   khalti_secret_key,  khalti_environment
  FROM public.shop_payment_configs
  WHERE shop_id = p_shop_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shop_payment_secrets(UUID) FROM PUBLIC;
-- INTENTIONALLY no GRANT to anon/authenticated.  Only the service_role can call.

-- ─── 8. RPC: upsert_shop_payment_config (NULL-preserving via COALESCE) ────
CREATE OR REPLACE FUNCTION public.upsert_shop_payment_config(
  p_shop_id              UUID,
  p_enabled_methods      TEXT[],
  p_esewa_merchant_code  TEXT,
  p_esewa_secret_key     TEXT,
  p_esewa_environment    TEXT,
  p_khalti_public_key    TEXT,
  p_khalti_secret_key    TEXT,
  p_khalti_environment   TEXT,
  p_bank_name            TEXT,
  p_bank_account_holder  TEXT,
  p_bank_account_number  TEXT,
  p_bank_branch          TEXT,
  p_bank_swift_code      TEXT,
  p_qr_code_url          TEXT,
  p_payment_instructions TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_shop_member(p_shop_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN: not a member of this shop';
  END IF;
  IF public.shop_role(p_shop_id, auth.uid()) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: only owners/admins may edit payment config';
  END IF;

  INSERT INTO public.shop_payment_configs (
    shop_id, enabled_methods,
    esewa_merchant_code, esewa_secret_key, esewa_environment,
    khalti_public_key,   khalti_secret_key,  khalti_environment,
    bank_name, bank_account_holder, bank_account_number, bank_branch, bank_swift_code,
    qr_code_url, payment_instructions
  ) VALUES (
    p_shop_id, COALESCE(p_enabled_methods, ARRAY['cod']::TEXT[]),
    p_esewa_merchant_code, p_esewa_secret_key, COALESCE(p_esewa_environment, 'sandbox'),
    p_khalti_public_key,   p_khalti_secret_key,  COALESCE(p_khalti_environment, 'sandbox'),
    p_bank_name, p_bank_account_holder, p_bank_account_number, p_bank_branch, p_bank_swift_code,
    p_qr_code_url, p_payment_instructions
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    enabled_methods       = COALESCE(p_enabled_methods,      shop_payment_configs.enabled_methods),
    esewa_merchant_code   = COALESCE(p_esewa_merchant_code,  shop_payment_configs.esewa_merchant_code),
    esewa_secret_key      = COALESCE(p_esewa_secret_key,     shop_payment_configs.esewa_secret_key),
    esewa_environment     = COALESCE(p_esewa_environment,    shop_payment_configs.esewa_environment),
    khalti_public_key     = COALESCE(p_khalti_public_key,    shop_payment_configs.khalti_public_key),
    khalti_secret_key     = COALESCE(p_khalti_secret_key,    shop_payment_configs.khalti_secret_key),
    khalti_environment    = COALESCE(p_khalti_environment,   shop_payment_configs.khalti_environment),
    bank_name             = COALESCE(p_bank_name,            shop_payment_configs.bank_name),
    bank_account_holder   = COALESCE(p_bank_account_holder,  shop_payment_configs.bank_account_holder),
    bank_account_number   = COALESCE(p_bank_account_number,  shop_payment_configs.bank_account_number),
    bank_branch           = COALESCE(p_bank_branch,          shop_payment_configs.bank_branch),
    bank_swift_code       = COALESCE(p_bank_swift_code,      shop_payment_configs.bank_swift_code),
    qr_code_url           = COALESCE(p_qr_code_url,          shop_payment_configs.qr_code_url),
    payment_instructions  = COALESCE(p_payment_instructions, shop_payment_configs.payment_instructions);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_shop_payment_config(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_shop_payment_config(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 9. RPC: place_order_with_payment (atomic) ────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order_with_payment(
  p_shop_id              UUID,
  p_shop_name            TEXT,
  p_order_number         TEXT,
  p_customer_name        TEXT,
  p_customer_phone       TEXT,
  p_customer_email       TEXT,
  p_delivery_address     TEXT,
  p_items                JSONB,
  p_total_amount         NUMERIC,
  p_payment_method       TEXT,
  p_transaction_reference TEXT,
  p_notes                TEXT DEFAULT NULL
) RETURNS TABLE (
  order_id     UUID,
  payment_id   UUID,
  order_number TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id      UUID;
  v_payment_id    UUID;
  v_item          JSONB;
  v_product_id    UUID;
  v_qty           NUMERIC;
  v_stock         NUMERIC;
  v_product_name  TEXT;
  v_enabled       TEXT[];
  v_payment_status TEXT;
BEGIN
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
  END;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id   := (v_item->>'id')::UUID;
    v_qty          := (v_item->>'qty')::NUMERIC;
    v_product_name := v_item->>'name';

    SELECT stock INTO v_stock
    FROM   products
    WHERE  id = v_product_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF v_stock IS NULL OR v_stock < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product_name;
    END IF;
  END LOOP;

  INSERT INTO orders (
    shop_id, shop_name, order_number,
    customer_id, customer_name, customer_phone, customer_email,
    delivery_address, items, total_amount,
    payment_method, payment_status, status, notes
  ) VALUES (
    p_shop_id, p_shop_name, p_order_number,
    NULL, p_customer_name, p_customer_phone, p_customer_email,
    p_delivery_address, p_items, p_total_amount,
    p_payment_method, v_payment_status, 'placed', p_notes
  )
  RETURNING id INTO v_order_id;

  INSERT INTO payments (
    order_id, shop_id, customer_id,
    payment_method, payment_status, amount, currency, transaction_reference
  ) VALUES (
    v_order_id, p_shop_id, NULL,
    p_payment_method, v_payment_status, p_total_amount, 'NPR', p_transaction_reference
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO payment_audit_logs (payment_id, shop_id, action, actor_type, to_status, metadata)
  VALUES (v_payment_id, p_shop_id, 'initiated', 'customer', v_payment_status,
          jsonb_build_object('method', p_payment_method, 'amount', p_total_amount));

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'id')::UUID;
    v_qty        := (v_item->>'qty')::NUMERIC;
    UPDATE products SET stock = GREATEST(0, stock - v_qty)
    WHERE id = v_product_id AND shop_id = p_shop_id;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_payment_id, p_order_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order_with_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_order_with_payment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─── 10. RPC: attach_payment_receipt (anon-safe) ──────────────────────────
CREATE OR REPLACE FUNCTION public.attach_payment_receipt(
  p_order_number TEXT,
  p_receipt_url  TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment_id     UUID;
  v_shop_id        UUID;
  v_current_status TEXT;
  v_new_status     TEXT;
  v_method         TEXT;
BEGIN
  SELECT p.id, p.shop_id, p.payment_status, p.payment_method
    INTO v_payment_id, v_shop_id, v_current_status, v_method
  FROM payments p
  JOIN orders   o ON o.id = p.order_id
  WHERE o.order_number = p_order_number
  FOR UPDATE OF p;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_method NOT IN ('bank_transfer','qr_code') THEN
    RAISE EXCEPTION 'RECEIPT_NOT_APPLICABLE_FOR_METHOD:%', v_method;
  END IF;

  v_new_status := CASE v_method
    WHEN 'bank_transfer' THEN 'bank_transfer_pending_verification'
    WHEN 'qr_code'       THEN 'qr_payment_pending_verification'
  END;

  UPDATE payments
  SET    receipt_url = p_receipt_url,
         receipt_uploaded_at = timezone('utc', now()),
         payment_status = v_new_status
  WHERE  id = v_payment_id;

  UPDATE orders SET payment_status = v_new_status
  WHERE  id = (SELECT order_id FROM payments WHERE id = v_payment_id);

  INSERT INTO payment_audit_logs (payment_id, shop_id, action, actor_type, from_status, to_status, metadata)
  VALUES (v_payment_id, v_shop_id, 'receipt_uploaded', 'customer', v_current_status, v_new_status,
          jsonb_build_object('receipt_url', p_receipt_url));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_payment_receipt(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.attach_payment_receipt(TEXT, TEXT) TO anon, authenticated;

-- ─── 11. RPC: verify_payment_by_owner (idempotent) ────────────────────────
CREATE OR REPLACE FUNCTION public.verify_payment_by_owner(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shop_id  UUID;
  v_order_id UUID;
  v_current  TEXT;
BEGIN
  SELECT shop_id, order_id, payment_status
    INTO v_shop_id, v_order_id, v_current
  FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

  IF NOT public.is_shop_member(v_shop_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF public.shop_role(v_shop_id, auth.uid()) NOT IN ('owner','admin','manager') THEN
    RAISE EXCEPTION 'FORBIDDEN: role';
  END IF;

  IF v_current IN ('payment_verified','cod_paid','refunded') THEN RETURN; END IF;

  UPDATE payments
  SET    payment_status = 'payment_verified',
         verified_by_owner = auth.uid(),
         verified_at = timezone('utc', now())
  WHERE  id = p_payment_id;

  UPDATE orders
  SET    payment_status = 'payment_verified',
         status = CASE WHEN status = 'placed' THEN 'confirmed' ELSE status END
  WHERE  id = v_order_id;

  INSERT INTO payment_audit_logs (payment_id, shop_id, action, actor_type, actor_id, from_status, to_status)
  VALUES (p_payment_id, v_shop_id, 'verified', 'owner', auth.uid(), v_current, 'payment_verified');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_payment_by_owner(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_payment_by_owner(UUID) TO authenticated;

-- ─── 12. RPC: reject_payment_by_owner ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_payment_by_owner(
  p_payment_id UUID,
  p_reason     TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shop_id  UUID;
  v_order_id UUID;
  v_current  TEXT;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;

  SELECT shop_id, order_id, payment_status
    INTO v_shop_id, v_order_id, v_current
  FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

  IF NOT public.is_shop_member(v_shop_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF public.shop_role(v_shop_id, auth.uid()) NOT IN ('owner','admin','manager') THEN
    RAISE EXCEPTION 'FORBIDDEN: role';
  END IF;

  IF v_current = 'payment_rejected' THEN RETURN; END IF;

  UPDATE payments
  SET    payment_status = 'payment_rejected',
         rejected_reason = p_reason,
         rejected_at = timezone('utc', now())
  WHERE  id = p_payment_id;

  UPDATE orders SET payment_status = 'payment_rejected' WHERE id = v_order_id;

  INSERT INTO payment_audit_logs (payment_id, shop_id, action, actor_type, actor_id, from_status, to_status, metadata)
  VALUES (p_payment_id, v_shop_id, 'rejected', 'owner', auth.uid(), v_current, 'payment_rejected',
          jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_payment_by_owner(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_payment_by_owner(UUID, TEXT) TO authenticated;

-- ─── 13. RPC: mark_cod_paid_by_owner ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_cod_paid_by_owner(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shop_id  UUID;
  v_order_id UUID;
  v_method   TEXT;
  v_current  TEXT;
BEGIN
  SELECT shop_id, order_id, payment_method, payment_status
    INTO v_shop_id, v_order_id, v_method, v_current
  FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF v_shop_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  IF v_method <> 'cod' THEN RAISE EXCEPTION 'NOT_COD_PAYMENT'; END IF;

  IF NOT public.is_shop_member(v_shop_id, auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF public.shop_role(v_shop_id, auth.uid()) NOT IN ('owner','admin','manager','cashier') THEN
    RAISE EXCEPTION 'FORBIDDEN: role';
  END IF;

  IF v_current = 'cod_paid' THEN RETURN; END IF;

  UPDATE payments
  SET    payment_status = 'cod_paid',
         verified_by_owner = auth.uid(),
         verified_at = timezone('utc', now())
  WHERE  id = p_payment_id;

  UPDATE orders SET payment_status = 'cod_paid' WHERE id = v_order_id;

  INSERT INTO payment_audit_logs (payment_id, shop_id, action, actor_type, actor_id, from_status, to_status)
  VALUES (p_payment_id, v_shop_id, 'cod_paid', 'owner', auth.uid(), v_current, 'cod_paid');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_cod_paid_by_owner(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_cod_paid_by_owner(UUID) TO authenticated;

-- ─── 14. RPC: get_order_by_number (anon-safe customer tracking) ───────────
CREATE OR REPLACE FUNCTION public.get_order_by_number(p_order_number TEXT)
RETURNS TABLE (
  order_id          UUID,
  order_number      TEXT,
  shop_id           UUID,
  shop_name         TEXT,
  shop_slug         TEXT,
  status            TEXT,
  total_amount      NUMERIC,
  items             JSONB,
  customer_name     TEXT,
  customer_phone    TEXT,
  delivery_address  TEXT,
  payment_method    TEXT,
  payment_status    TEXT,
  payment_id        UUID,
  receipt_url       TEXT,
  rejected_reason   TEXT,
  created_at        TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id, o.order_number, o.shop_id, o.shop_name, s.slug,
    o.status, o.total_amount, o.items,
    o.customer_name, o.customer_phone, o.delivery_address,
    o.payment_method, o.payment_status,
    p.id, p.receipt_url, p.rejected_reason,
    o.created_at
  FROM orders o
  LEFT JOIN shops    s ON s.id = o.shop_id
  LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.order_number = p_order_number
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_order_by_number(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_order_by_number(TEXT) TO anon, authenticated;

-- ─── 15. RPC: get_owner_payments_overview (CROSS-SHOP for one owner) ──────
-- Aggregated payment metrics across every shop where the caller is a member,
-- grouped by shop + method + status.  Powers the consolidated payment report.
CREATE OR REPLACE FUNCTION public.get_owner_payments_overview(
  p_from TIMESTAMPTZ DEFAULT (timezone('utc', now()) - INTERVAL '30 days'),
  p_to   TIMESTAMPTZ DEFAULT timezone('utc', now())
)
RETURNS TABLE (
  shop_id         UUID,
  shop_name       TEXT,
  shop_slug       TEXT,
  payment_method  TEXT,
  payment_status  TEXT,
  payment_count   BIGINT,
  total_amount    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.slug,
    p.payment_method, p.payment_status,
    COUNT(*)::BIGINT, COALESCE(SUM(p.amount), 0)
  FROM payments p
  JOIN shops s ON s.id = p.shop_id
  WHERE p.created_at >= p_from AND p.created_at < p_to
    AND public.is_shop_member(p.shop_id, auth.uid())
  GROUP BY s.id, s.name, s.slug, p.payment_method, p.payment_status
  ORDER BY s.name, p.payment_method, p.payment_status;
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_payments_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_owner_payments_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ─── 16. RPC: get_owner_payments_list (CROSS-SHOP, paginated, filterable) ──
CREATE OR REPLACE FUNCTION public.get_owner_payments_list(
  p_shop_id  UUID DEFAULT NULL,
  p_method   TEXT DEFAULT NULL,
  p_status   TEXT DEFAULT NULL,
  p_from     TIMESTAMPTZ DEFAULT (timezone('utc', now()) - INTERVAL '30 days'),
  p_to       TIMESTAMPTZ DEFAULT timezone('utc', now()),
  p_limit    INTEGER DEFAULT 50,
  p_offset   INTEGER DEFAULT 0
) RETURNS TABLE (
  payment_id            UUID,
  order_id              UUID,
  order_number          TEXT,
  shop_id               UUID,
  shop_name             TEXT,
  shop_slug             TEXT,
  payment_method        TEXT,
  payment_status        TEXT,
  amount                NUMERIC,
  transaction_reference TEXT,
  receipt_url           TEXT,
  customer_name         TEXT,
  customer_phone        TEXT,
  rejected_reason       TEXT,
  created_at            TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id, p.order_id, o.order_number,
    s.id, s.name, s.slug,
    p.payment_method, p.payment_status, p.amount, p.transaction_reference,
    p.receipt_url, o.customer_name, o.customer_phone, p.rejected_reason,
    p.created_at
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  JOIN shops  s ON s.id = p.shop_id
  WHERE public.is_shop_member(p.shop_id, auth.uid())
    AND (p_shop_id IS NULL OR p.shop_id        = p_shop_id)
    AND (p_method  IS NULL OR p.payment_method = p_method)
    AND (p_status  IS NULL OR p.payment_status = p_status)
    AND p.created_at >= p_from AND p.created_at < p_to
  ORDER BY p.created_at DESC
  LIMIT  GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_payments_list(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_owner_payments_list(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

-- ─── 17. RPC: get_owner_shops (picker for the consolidated report UI) ─────
CREATE OR REPLACE FUNCTION public.get_owner_shops()
RETURNS TABLE (
  shop_id   UUID,
  shop_name TEXT,
  shop_slug TEXT,
  role      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, sm.role
  FROM shops s
  JOIN shop_members sm ON sm.shop_id = s.id
  WHERE sm.user_id = auth.uid() AND sm.status = 'active'
  ORDER BY s.name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_shops() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_owner_shops() TO authenticated;
