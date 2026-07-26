
-- 1. Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_no text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS coupon_code text;

-- Widen status check to include 'closed' (used by legacy code) as alias for 'paid'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['open','placed','preparing','ready','served','paid','closed','cancelled']));

-- 2. Restaurant billing defaults
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tax_pct numeric(5,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS service_pct numeric(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 3. Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percent','fixed')),
  value numeric(10,2) NOT NULL CHECK (value > 0),
  min_subtotal_cents integer NOT NULL DEFAULT 0,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read coupons" ON public.coupons FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'waiter'));
CREATE POLICY "managers manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE TRIGGER touch_coupons BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash','card','upi','wallet','bank','other')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  tip_cents integer NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  txn_ref text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read payments" ON public.payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'waiter'));
CREATE POLICY "staff insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'waiter'));
CREATE POLICY "managers manage payments" ON public.payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- 5. Invoice sequence
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000;

-- 6. Helper: recompute order totals
CREATE OR REPLACE FUNCTION public.recalc_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub int := 0;
  v_r RECORD;
  v_ord RECORD;
  v_tax int;
  v_svc int;
  v_disc int;
BEGIN
  SELECT COALESCE(SUM(unit_price_cents*quantity),0) INTO v_sub
    FROM public.order_items WHERE order_id = p_order_id AND status <> 'cancelled';
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT tax_pct, service_pct INTO v_r FROM public.restaurants WHERE id = v_ord.restaurant_id;

  v_disc := LEAST(GREATEST(v_ord.discount_cents,0), v_sub);
  v_svc  := ROUND((v_sub - v_disc) * COALESCE(v_r.service_pct,0) / 100.0);
  v_tax  := ROUND((v_sub - v_disc + v_svc) * COALESCE(v_r.tax_pct,0) / 100.0);

  UPDATE public.orders
     SET subtotal_cents = v_sub,
         service_charge_cents = v_svc,
         tax_cents = v_tax,
         discount_cents = v_disc,
         total_cents = GREATEST(v_sub - v_disc + v_svc + v_tax + COALESCE(v_ord.tip_cents,0), 0)
   WHERE id = p_order_id;
END; $$;
REVOKE ALL ON FUNCTION public.recalc_order(uuid) FROM PUBLIC, anon, authenticated;

-- 7. Staff-only mutating RPCs
CREATE OR REPLACE FUNCTION public._require_staff() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'waiter')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public._require_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._require_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_add_order_item(p_order_id uuid, p_menu_item_id uuid, p_quantity int, p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_menu RECORD; v_ord RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order not editable'; END IF;
  SELECT * INTO v_menu FROM public.menu_items WHERE id = p_menu_item_id AND restaurant_id = v_ord.restaurant_id AND is_available;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable'; END IF;
  INSERT INTO public.order_items(order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes, status)
  VALUES (p_order_id, v_menu.id, v_menu.name, v_menu.price_cents,
          GREATEST(1, LEAST(COALESCE(p_quantity,1),50)),
          NULLIF(LEFT(COALESCE(p_notes,''),300),''), 'queued')
  RETURNING id INTO v_id;
  PERFORM public.recalc_order(p_order_id);
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_add_order_item(uuid,uuid,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_update_order_item(p_item_id uuid, p_quantity int, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD; v_ord RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_item FROM public.order_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  SELECT * INTO v_ord FROM public.orders WHERE id = v_item.order_id;
  IF v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order locked'; END IF;
  UPDATE public.order_items
     SET quantity = GREATEST(1, LEAST(COALESCE(p_quantity,quantity),50)),
         notes = COALESCE(NULLIF(LEFT(COALESCE(p_notes,''),300),''), notes)
   WHERE id = p_item_id;
  PERFORM public.recalc_order(v_item.order_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_update_order_item(uuid,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_remove_order_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD; v_ord RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_item FROM public.order_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_ord FROM public.orders WHERE id = v_item.order_id;
  IF v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order locked'; END IF;
  DELETE FROM public.order_items WHERE id = p_item_id;
  PERFORM public.recalc_order(v_item.order_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_remove_order_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_order_charges(p_order_id uuid, p_discount_cents int, p_tip_cents int, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order locked'; END IF;
  UPDATE public.orders
     SET discount_cents = GREATEST(COALESCE(p_discount_cents,0),0),
         tip_cents = GREATEST(COALESCE(p_tip_cents,0),0),
         notes = COALESCE(NULLIF(LEFT(COALESCE(p_notes,''),500),''), notes)
   WHERE id = p_order_id;
  PERFORM public.recalc_order(p_order_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_set_order_charges(uuid,int,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_apply_coupon(p_order_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD; v_c RECORD; v_disc int;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order locked'; END IF;
  SELECT * INTO v_c FROM public.coupons
    WHERE restaurant_id = v_ord.restaurant_id AND code = UPPER(TRIM(p_code)) AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
  IF v_c.expires_at IS NOT NULL AND v_c.expires_at < now() THEN RAISE EXCEPTION 'Coupon expired'; END IF;
  IF v_c.max_uses IS NOT NULL AND v_c.uses >= v_c.max_uses THEN RAISE EXCEPTION 'Coupon exhausted'; END IF;
  IF v_ord.subtotal_cents < v_c.min_subtotal_cents THEN RAISE EXCEPTION 'Minimum subtotal not met'; END IF;

  IF v_c.kind = 'percent' THEN
    v_disc := ROUND(v_ord.subtotal_cents * v_c.value / 100.0);
  ELSE
    v_disc := ROUND(v_c.value * 100);
  END IF;
  v_disc := LEAST(v_disc, v_ord.subtotal_cents);
  UPDATE public.orders SET discount_cents = v_disc, coupon_code = v_c.code WHERE id = p_order_id;
  PERFORM public.recalc_order(p_order_id);
  RETURN jsonb_build_object('discount_cents', v_disc, 'code', v_c.code);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_apply_coupon(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_add_payment(p_order_id uuid, p_method text, p_amount_cents int, p_tip_cents int, p_txn_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD; v_id uuid;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order not payable'; END IF;
  INSERT INTO public.payments(order_id, restaurant_id, method, amount_cents, tip_cents, txn_ref, created_by)
  VALUES (p_order_id, v_ord.restaurant_id, p_method, GREATEST(COALESCE(p_amount_cents,0),0),
          GREATEST(COALESCE(p_tip_cents,0),0), NULLIF(LEFT(COALESCE(p_txn_ref,''),80),''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_add_payment(uuid,text,int,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_void_payment(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.payments WHERE id = p_payment_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_void_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_close_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD; v_paid int; v_tips int; v_inv text;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_ord.status IN ('paid','closed','cancelled') THEN
    RETURN jsonb_build_object('invoice_no', v_ord.invoice_no, 'already_closed', true);
  END IF;
  PERFORM public.recalc_order(p_order_id);
  SELECT COALESCE(SUM(amount_cents),0), COALESCE(SUM(tip_cents),0) INTO v_paid, v_tips
    FROM public.payments WHERE order_id = p_order_id;

  -- refresh order after recalc
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;

  IF v_paid < v_ord.total_cents THEN
    RAISE EXCEPTION 'Underpaid: paid % of %', v_paid, v_ord.total_cents;
  END IF;

  v_inv := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || nextval('public.invoice_seq');
  UPDATE public.orders
     SET status = 'paid', invoice_no = v_inv, closed_at = now(),
         tip_cents = GREATEST(v_ord.tip_cents, v_tips)
   WHERE id = p_order_id;

  IF v_ord.coupon_code IS NOT NULL THEN
    UPDATE public.coupons SET uses = uses + 1
     WHERE restaurant_id = v_ord.restaurant_id AND code = v_ord.coupon_code;
  END IF;

  RETURN jsonb_build_object('invoice_no', v_inv, 'total_cents', v_ord.total_cents, 'paid_cents', v_paid);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_close_order(uuid) TO authenticated;

-- 8. Split order: move given item_ids to a new order
CREATE OR REPLACE FUNCTION public.staff_split_order(p_order_id uuid, p_item_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD; v_new uuid;
BEGIN
  PERFORM public._require_staff();
  IF p_item_ids IS NULL OR array_length(p_item_ids,1) IS NULL THEN RAISE EXCEPTION 'No items provided'; END IF;
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order locked'; END IF;
  INSERT INTO public.orders(restaurant_id, table_id, status, guest_name)
  VALUES (v_ord.restaurant_id, v_ord.table_id, v_ord.status, COALESCE(v_ord.guest_name,'Guest') || ' (split)')
  RETURNING id INTO v_new;
  UPDATE public.order_items SET order_id = v_new
   WHERE order_id = p_order_id AND id = ANY(p_item_ids);
  PERFORM public.recalc_order(p_order_id);
  PERFORM public.recalc_order(v_new);
  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_split_order(uuid,uuid[]) TO authenticated;

-- 9. Merge orders: fold source into target on same restaurant
CREATE OR REPLACE FUNCTION public.staff_merge_orders(p_source_id uuid, p_target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD; v_t RECORD;
BEGIN
  PERFORM public._require_staff();
  IF p_source_id = p_target_id THEN RAISE EXCEPTION 'Cannot merge with self'; END IF;
  SELECT * INTO v_s FROM public.orders WHERE id = p_source_id;
  SELECT * INTO v_t FROM public.orders WHERE id = p_target_id;
  IF v_s.restaurant_id IS DISTINCT FROM v_t.restaurant_id THEN RAISE EXCEPTION 'Different restaurants'; END IF;
  IF v_s.status IN ('paid','closed','cancelled') OR v_t.status IN ('paid','closed','cancelled') THEN
    RAISE EXCEPTION 'Order locked'; END IF;
  UPDATE public.order_items SET order_id = p_target_id WHERE order_id = p_source_id;
  UPDATE public.payments SET order_id = p_target_id WHERE order_id = p_source_id;
  DELETE FROM public.orders WHERE id = p_source_id;
  PERFORM public.recalc_order(p_target_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_merge_orders(uuid,uuid) TO authenticated;

-- 10. Backfill subtotal_cents for existing orders
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE status NOT IN ('paid','closed','cancelled') LOOP
    PERFORM public.recalc_order(r.id);
  END LOOP;
END $$;

-- 11. Seed a demo coupon
INSERT INTO public.coupons(restaurant_id, code, kind, value, min_subtotal_cents, active)
SELECT id, 'WELCOME10', 'percent', 10, 0, true FROM public.restaurants
ON CONFLICT (restaurant_id, code) DO NOTHING;
