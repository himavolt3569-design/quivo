-- Order lifecycle hardening.
--
-- Problem: orders.status could be set to ANY value from the client via the
-- owner UPDATE RLS policy (updateOrderStatus did a bare UPDATE). That let a
-- caller skip steps, move backwards, deliver an unpaid prepaid order, or
-- cancel a PAID order with no refund and no restock.
--
-- This migration introduces:
--   1. Cancellation bookkeeping columns + an order_status_history audit table.
--   2. transition_order_status(): the ONE sanctioned, payment-aware path for
--      changing orders.status. It validates the actor, the transition, and the
--      payment state, and on cancellation atomically restocks, refunds the
--      wallet, and (for captured money) writes a completed refund.
--   3. A BEFORE UPDATE trigger that REJECTS any status change not made through
--      the RPC (the RPC sets a transaction-local GUC to authorise itself), so
--      the guarantees hold even against direct client UPDATEs.
--
-- payment_status changes (gateway callbacks, owner verification, COD collect)
-- do NOT touch `status`, so the trigger never interferes with them.

-- ─── 1. Columns + audit table ────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason      TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by_role  TEXT
    CHECK (cancelled_by_role IN ('customer', 'owner', 'system')),
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  TEXT NOT NULL CHECK (actor_role IN ('customer', 'owner', 'system')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history(order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- The order's customer and any shop member can read the timeline. Rows are
-- only ever written by the SECURITY DEFINER RPC (no INSERT policy).
DROP POLICY IF EXISTS "order_history: participants read" ON public.order_status_history;
CREATE POLICY "order_history: participants read"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    public.is_shop_member(shop_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND o.customer_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;

-- ─── 2. transition_order_status() ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id        UUID,
  p_new_status      TEXT,
  p_expected_status TEXT DEFAULT NULL,
  p_reason          TEXT DEFAULT NULL
)
RETURNS TABLE (status TEXT, payment_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order       public.orders%ROWTYPE;
  v_uid         UUID := auth.uid();
  v_is_member   BOOLEAN;
  v_is_customer BOOLEAN;
  v_actor_role  TEXT;
  v_new_pay     TEXT;
  v_line        RECORD;
  v_target_batch UUID;
  v_refund_id   UUID;
  v_reason      TEXT := NULLIF(left(COALESCE(p_reason, ''), 500), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_is_member   := public.is_shop_member(v_order.shop_id, v_uid);
  v_is_customer := (v_order.customer_id = v_uid);
  IF NOT (v_is_member OR v_is_customer) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  -- A shop member acting on their own order is still treated as the shop.
  v_actor_role := CASE WHEN v_is_member THEN 'owner' ELSE 'customer' END;

  IF p_new_status NOT IN
     ('placed','confirmed','packing','out_for_delivery','delivered','cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS:%', p_new_status USING ERRCODE = '22023';
  END IF;

  -- Optimistic concurrency: caller asserts the status it saw.
  IF p_expected_status IS NOT NULL AND v_order.status <> p_expected_status THEN
    RAISE EXCEPTION 'STATUS_CONFLICT:%', v_order.status USING ERRCODE = '40001';
  END IF;

  -- Idempotent no-op.
  IF v_order.status = p_new_status THEN
    RETURN QUERY SELECT v_order.status, v_order.payment_status;
    RETURN;
  END IF;

  -- delivered & cancelled are terminal.
  IF v_order.status IN ('delivered','cancelled') THEN
    RAISE EXCEPTION 'ORDER_FINALIZED:%', v_order.status USING ERRCODE = '22023';
  END IF;

  v_new_pay := v_order.payment_status;

  -- ─── Cancellation ──────────────────────────────────────────────────────────
  IF p_new_status = 'cancelled' THEN
    IF v_actor_role = 'customer' AND v_order.status <> 'placed' THEN
      RAISE EXCEPTION 'CUSTOMER_CANCEL_WINDOW_CLOSED' USING ERRCODE = '42501';
    END IF;
    IF v_actor_role = 'owner'
       AND v_order.status NOT IN ('placed','confirmed','packing') THEN
      RAISE EXCEPTION 'OWNER_CANCEL_WINDOW_CLOSED' USING ERRCODE = '42501';
    END IF;

    -- Restock every line (batch-aware: bump newest batch so FEFO still drains
    -- older batches first; non-batched products restore directly).
    -- Items are stored as {id|product_id, qty|quantity, ...}; tolerate both
    -- shapes (storefront RPC writes id/qty; the legacy placeOrder path uses
    -- product_id/quantity). Lines without a product link can't be restocked.
    FOR v_line IN
      SELECT COALESCE(value->>'id', value->>'product_id')::UUID AS pid,
             SUM(COALESCE(value->>'qty', value->>'quantity')::NUMERIC) AS qty
      FROM jsonb_array_elements(v_order.items)
      WHERE (value ? 'id' OR value ? 'product_id')
        AND (value ? 'qty' OR value ? 'quantity')
      GROUP BY COALESCE(value->>'id', value->>'product_id')
    LOOP
      IF v_line.pid IS NULL OR v_line.qty IS NULL OR v_line.qty <= 0 THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_target_batch
      FROM public.product_batches
      WHERE product_id = v_line.pid AND shop_id = v_order.shop_id
      ORDER BY received_at DESC LIMIT 1 FOR UPDATE;

      IF v_target_batch IS NOT NULL THEN
        UPDATE public.product_batches
           SET remaining_qty = remaining_qty + v_line.qty
         WHERE id = v_target_batch;
      ELSE
        UPDATE public.products
           SET stock = stock + v_line.qty
         WHERE id = v_line.pid AND shop_id = v_order.shop_id;
      END IF;
    END LOOP;

    -- Release a redeemed promo code.
    IF v_order.promo_code_id IS NOT NULL THEN
      UPDATE public.promo_codes
         SET used_count = GREATEST(used_count - 1, 0)
       WHERE id = v_order.promo_code_id;
    END IF;

    -- Refund redeemed wallet credit (debited at placement) back to the wallet.
    IF COALESCE(v_order.wallet_used, 0) > 0 AND v_order.customer_id IS NOT NULL THEN
      UPDATE public.profiles
         SET wallet_balance = wallet_balance + v_order.wallet_used
       WHERE id = v_order.customer_id;
      INSERT INTO public.wallet_transactions (customer_id, amount, type, description)
      VALUES (v_order.customer_id, v_order.wallet_used, 'credit',
              'Order ' || v_order.order_number || ' — cancellation refund');
    END IF;

    -- Captured money (prepaid gateway OR collected COD) → write a completed
    -- refund + finance offset so the cash/transfer to return is on the books.
    IF v_order.payment_status IN ('payment_verified', 'cod_paid')
       AND COALESCE(v_order.total_amount, 0) > 0 THEN
      INSERT INTO public.refunds (
        shop_id, order_id, refund_amount, tax_refunded, reason,
        status, processed_by, processed_at, created_by
      ) VALUES (
        v_order.shop_id, p_order_id, v_order.total_amount,
        COALESCE(v_order.tax_amount, 0),
        'Order cancelled' || COALESCE(' — ' || v_reason, ''),
        'completed', v_uid, timezone('utc', now()), v_uid
      ) RETURNING id INTO v_refund_id;

      INSERT INTO public.refund_items (refund_id, product_id, qty, line_amount)
      SELECT v_refund_id,
             COALESCE(value->>'id', value->>'product_id')::UUID,
             COALESCE(value->>'qty', value->>'quantity')::NUMERIC,
             round(COALESCE((value->>'price')::NUMERIC, 0)
                   * COALESCE(value->>'qty', value->>'quantity')::NUMERIC, 2)
      FROM jsonb_array_elements(v_order.items)
      WHERE (value ? 'id' OR value ? 'product_id')
        AND (value ? 'qty' OR value ? 'quantity')
        AND COALESCE(value->>'qty', value->>'quantity')::NUMERIC > 0;

      INSERT INTO public.shop_transactions (
        shop_id, amount, type, description,
        subtotal, discount_amount, tax_rate, tax_amount,
        payment_method, reference_id, created_by
      ) VALUES (
        v_order.shop_id, -v_order.total_amount, 'expense',
        CONCAT('Refund: order ', v_order.order_number, ' cancelled'),
        -GREATEST(v_order.total_amount - COALESCE(v_order.tax_amount, 0), 0),
        0, 0, -COALESCE(v_order.tax_amount, 0),
        'cash', v_refund_id::TEXT, v_uid
      );

      INSERT INTO public.domain_events (name, payload, aggregate_id, shop_id, user_id)
      VALUES ('refund.completed',
              jsonb_build_object('refund_id', v_refund_id, 'shop_id', v_order.shop_id,
                                 'amount', v_order.total_amount, 'order_id', p_order_id),
              v_refund_id, v_order.shop_id, v_uid);

      v_new_pay := 'refunded';
    ELSIF v_order.payment_status NOT IN ('cod_paid', 'refunded') THEN
      -- Nothing captured yet (COD pending, gateway initiated, awaiting receipt).
      v_new_pay := 'payment_cancelled';
    END IF;

  -- ─── Mark delivered: settle payment ────────────────────────────────────────
  ELSIF p_new_status = 'delivered' THEN
    IF v_order.payment_method = 'cod' THEN
      IF v_order.payment_status = 'cod_pending' THEN
        v_new_pay := 'cod_paid';
      END IF;
    ELSIF v_order.payment_status <> 'payment_verified' THEN
      RAISE EXCEPTION 'PAYMENT_NOT_SETTLED:%', v_order.payment_status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ─── Forward fulfilment edges (everything except cancel) ───────────────────
  IF p_new_status <> 'cancelled' THEN
    IF v_actor_role <> 'owner' THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;
    IF NOT (
         (v_order.status = 'placed'            AND p_new_status = 'confirmed')
      OR (v_order.status = 'confirmed'         AND p_new_status = 'packing')
      OR (v_order.status = 'packing'           AND p_new_status = 'out_for_delivery')
      OR (v_order.status = 'out_for_delivery'  AND p_new_status = 'delivered')
    ) THEN
      RAISE EXCEPTION 'INVALID_TRANSITION:%->%', v_order.status, p_new_status
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ─── Apply (authorise the guarded UPDATE for this transaction) ─────────────
  PERFORM set_config('quivo.allow_status_transition', 'on', true);

  UPDATE public.orders
     SET status            = p_new_status,
         payment_status    = v_new_pay,
         cancel_reason     = CASE WHEN p_new_status = 'cancelled' THEN v_reason     ELSE cancel_reason     END,
         cancelled_by      = CASE WHEN p_new_status = 'cancelled' THEN v_uid        ELSE cancelled_by      END,
         cancelled_by_role = CASE WHEN p_new_status = 'cancelled' THEN v_actor_role ELSE cancelled_by_role END,
         cancelled_at      = CASE WHEN p_new_status = 'cancelled' THEN timezone('utc', now()) ELSE cancelled_at END
   WHERE id = p_order_id;

  IF v_new_pay IS DISTINCT FROM v_order.payment_status THEN
    UPDATE public.payments SET payment_status = v_new_pay WHERE order_id = p_order_id;
  END IF;

  INSERT INTO public.order_status_history
    (order_id, shop_id, from_status, to_status, actor_id, actor_role, reason)
  VALUES
    (p_order_id, v_order.shop_id, v_order.status, p_new_status, v_uid, v_actor_role, v_reason);

  INSERT INTO public.domain_events (name, payload, aggregate_id, shop_id, user_id)
  VALUES ('order.status_changed',
          jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number,
                             'from', v_order.status, 'to', p_new_status,
                             'actor_role', v_actor_role, 'payment_status', v_new_pay),
          p_order_id, v_order.shop_id, v_uid);

  RETURN QUERY SELECT p_new_status, v_new_pay;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_order_status(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.transition_order_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 3. Guard trigger ────────────────────────────────────────────────────────
-- The threat model is a direct UPDATE from the browser: the orders UPDATE RLS
-- policy runs as the `authenticated` (or `anon`) role, so a customer or shop
-- owner could otherwise PATCH orders.status to anything. We block exactly those
-- two client roles from changing `status` unless the change comes through
-- transition_order_status() (which sets the transaction-local GUC).
--
-- Everything else is trusted server-side code and passes through:
--   • the `service_role` key (gateway callbacks: place→confirm on verified pay)
--   • SECURITY DEFINER RPCs running as the definer/owner role, e.g.
--     verify_payment_by_owner() moving place→confirm on receipt approval.
-- payment_status-only writes never trip this (NEW.status = OLD.status).

CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('quivo.allow_status_transition', true) IS DISTINCT FROM 'on'
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION
      'orders.status can only be changed via transition_order_status()'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status ON public.orders;
CREATE TRIGGER trg_enforce_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_transition();
