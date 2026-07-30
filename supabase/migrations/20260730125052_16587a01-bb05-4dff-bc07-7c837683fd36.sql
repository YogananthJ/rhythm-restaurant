-- 1) Coupons must stream live to the billing screen
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
ALTER TABLE public.coupons REPLICA IDENTITY FULL;

-- 2) Percentage coupons must re-price when the ticket changes
CREATE OR REPLACE FUNCTION public.recalc_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub int := 0;
  v_r RECORD;
  v_ord RECORD;
  v_c RECORD;
  v_tax int;
  v_svc int;
  v_disc int;
BEGIN
  SELECT COALESCE(SUM(unit_price_cents*quantity),0) INTO v_sub
    FROM public.order_items WHERE order_id = p_order_id AND status <> 'cancelled';
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT tax_pct, service_pct INTO v_r FROM public.restaurants WHERE id = v_ord.restaurant_id;

  v_disc := LEAST(GREATEST(COALESCE(v_ord.discount_cents,0),0), v_sub);

  -- Re-derive coupon discount from the CURRENT subtotal so adding/removing
  -- items after a coupon was applied cannot leave a stale discount behind.
  IF v_ord.coupon_code IS NOT NULL THEN
    SELECT * INTO v_c FROM public.coupons
      WHERE restaurant_id = v_ord.restaurant_id AND code = v_ord.coupon_code;
    IF FOUND THEN
      IF v_sub < v_c.min_subtotal_cents THEN
        v_disc := 0;
        UPDATE public.orders SET coupon_code = NULL WHERE id = p_order_id;
      ELSIF v_c.kind = 'percent' THEN
        v_disc := LEAST(ROUND(v_sub * v_c.value / 100.0), v_sub);
      ELSE
        v_disc := LEAST(ROUND(v_c.value * 100), v_sub);
      END IF;
    END IF;
  END IF;

  v_svc  := ROUND((v_sub - v_disc) * COALESCE(v_r.service_pct,0) / 100.0);
  v_tax  := ROUND((v_sub - v_disc + v_svc) * COALESCE(v_r.tax_pct,0) / 100.0);

  UPDATE public.orders
     SET subtotal_cents = v_sub,
         service_charge_cents = v_svc,
         tax_cents = v_tax,
         discount_cents = v_disc,
         total_cents = GREATEST(v_sub - v_disc + v_svc + v_tax + COALESCE(v_ord.tip_cents,0), 0)
   WHERE id = p_order_id;
END; $function$;

-- 3) A payment on a settled ticket must not be deletable
CREATE OR REPLACE FUNCTION public.staff_void_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_p RECORD; v_ord RECORD;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_ord FROM public.orders WHERE id = v_p.order_id;
  IF v_ord.status IN ('paid','closed','cancelled') THEN
    RAISE EXCEPTION 'Cannot void a payment on a settled ticket';
  END IF;
  DELETE FROM public.payments WHERE id = p_payment_id;
END; $function$;

-- 4) Payment amounts must be sane
CREATE OR REPLACE FUNCTION public.staff_add_payment(p_order_id uuid, p_method text, p_amount_cents integer, p_tip_cents integer, p_txn_ref text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ord RECORD; v_id uuid;
BEGIN
  PERFORM public._require_staff();
  IF COALESCE(p_amount_cents,0) <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  IF p_method NOT IN ('cash','card','upi','wallet','bank','other') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_ord.status IN ('paid','closed','cancelled') THEN RAISE EXCEPTION 'Order not payable'; END IF;
  INSERT INTO public.payments(order_id, restaurant_id, method, amount_cents, tip_cents, txn_ref, created_by)
  VALUES (p_order_id, v_ord.restaurant_id, p_method, p_amount_cents,
          GREATEST(COALESCE(p_tip_cents,0),0), NULLIF(LEFT(COALESCE(p_txn_ref,''),80),''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

-- 5) Tips taken on the payment line must land on the invoice total
CREATE OR REPLACE FUNCTION public.staff_close_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ord RECORD; v_paid int; v_tips int; v_inv text;
BEGIN
  PERFORM public._require_staff();
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_ord.status IN ('paid','closed','cancelled') THEN
    RETURN jsonb_build_object('invoice_no', v_ord.invoice_no, 'already_closed', true);
  END IF;

  SELECT COALESCE(SUM(amount_cents),0), COALESCE(SUM(tip_cents),0) INTO v_paid, v_tips
    FROM public.payments WHERE order_id = p_order_id;

  -- fold payment-line tips into the order tip, then re-total so the printed
  -- invoice reconciles exactly against the payment rows
  UPDATE public.orders SET tip_cents = GREATEST(COALESCE(tip_cents,0), v_tips) WHERE id = p_order_id;
  PERFORM public.recalc_order(p_order_id);
  SELECT * INTO v_ord FROM public.orders WHERE id = p_order_id;

  IF (v_paid + v_tips) < v_ord.total_cents THEN
    RAISE EXCEPTION 'Underpaid: paid % of %', (v_paid + v_tips), v_ord.total_cents;
  END IF;

  v_inv := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || nextval('public.invoice_seq');
  UPDATE public.orders
     SET status = 'paid', invoice_no = v_inv, closed_at = now()
   WHERE id = p_order_id;

  IF v_ord.coupon_code IS NOT NULL THEN
    UPDATE public.coupons SET uses = uses + 1
     WHERE restaurant_id = v_ord.restaurant_id AND code = v_ord.coupon_code;
  END IF;

  RETURN jsonb_build_object('invoice_no', v_inv, 'total_cents', v_ord.total_cents,
                            'paid_cents', v_paid + v_tips,
                            'change_cents', GREATEST((v_paid + v_tips) - v_ord.total_cents, 0));
END; $function$;

-- 6) Applying a coupon should not be able to under/over-shoot the current ticket
CREATE OR REPLACE FUNCTION public.staff_apply_coupon(p_order_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE public.orders SET coupon_code = v_c.code WHERE id = p_order_id;
  PERFORM public.recalc_order(p_order_id);
  SELECT discount_cents INTO v_disc FROM public.orders WHERE id = p_order_id;
  RETURN jsonb_build_object('discount_cents', v_disc, 'code', v_c.code);
END; $function$;

-- 7) Coupon values must be valid at rest
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_value_sane;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_value_sane
  CHECK (value > 0 AND (kind <> 'percent' OR value <= 100));