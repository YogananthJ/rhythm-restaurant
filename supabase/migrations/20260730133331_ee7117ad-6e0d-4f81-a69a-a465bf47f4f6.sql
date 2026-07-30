CREATE OR REPLACE FUNCTION public.place_guest_order(p_qr_token text, p_guest_name text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table RECORD;
  v_order_id uuid;
  v_access_token text;
  v_total int := 0;
  v_item jsonb;
  v_menu RECORD;
BEGIN
  SELECT id, restaurant_id INTO v_table FROM public.dining_tables WHERE qr_token = p_qr_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Table not found'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Empty order'; END IF;
  IF jsonb_array_length(p_items) > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, price_cents, is_available, restaurant_id INTO v_menu
      FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    IF NOT FOUND OR v_menu.restaurant_id <> v_table.restaurant_id OR NOT v_menu.is_available THEN
      RAISE EXCEPTION 'Item unavailable';
    END IF;
    v_total := v_total + v_menu.price_cents * GREATEST(1, LEAST((v_item->>'quantity')::int, 20));
  END LOOP;

  INSERT INTO public.orders (restaurant_id, table_id, status, guest_name, subtotal_cents, total_cents)
  VALUES (v_table.restaurant_id, v_table.id, 'placed',
          COALESCE(NULLIF(LEFT(p_guest_name, 80), ''), 'Guest'), v_total, v_total)
  RETURNING id, access_token INTO v_order_id, v_access_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, price_cents INTO v_menu FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes, status)
    VALUES (v_order_id, v_menu.id, v_menu.name, v_menu.price_cents,
            GREATEST(1, LEAST((v_item->>'quantity')::int, 20)),
            NULLIF(LEFT(COALESCE(v_item->>'notes',''), 300), ''), 'queued');
  END LOOP;

  -- Apply restaurant tax + service charge so the guest ticket totals match
  -- staff-created tickets, reports and invoices.
  PERFORM public.recalc_order(v_order_id);

  RETURN jsonb_build_object('order_id', v_order_id, 'access_token', v_access_token);
END;
$function$;

-- Backfill guest orders that were created before the fix.
UPDATE public.orders o
   SET subtotal_cents = sub.s
  FROM (
    SELECT order_id, COALESCE(SUM(unit_price_cents * quantity), 0) AS s
      FROM public.order_items WHERE status <> 'cancelled' GROUP BY order_id
  ) sub
 WHERE o.id = sub.order_id
   AND o.subtotal_cents = 0
   AND o.status NOT IN ('paid','closed','cancelled');