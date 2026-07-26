
-- 1. Restrict dining_tables: remove public read (exposes qr_token). Provide RPC for guest lookup.
DROP POLICY IF EXISTS "tables public read" ON public.dining_tables;

CREATE OR REPLACE FUNCTION public.resolve_table_by_qr(p_qr_token text)
RETURNS TABLE(id uuid, label text, restaurant_id uuid, restaurant_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.label, t.restaurant_id, r.name
  FROM public.dining_tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.qr_token = p_qr_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_table_by_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_table_by_qr(text) TO anon, authenticated;

-- 2. Guest order placement via RPC (returns access_token so guests never need SELECT on orders).
CREATE OR REPLACE FUNCTION public.place_guest_order(
  p_qr_token text,
  p_guest_name text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Validate & total from server-side prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, price_cents, is_available, restaurant_id INTO v_menu
      FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    IF NOT FOUND OR v_menu.restaurant_id <> v_table.restaurant_id OR NOT v_menu.is_available THEN
      RAISE EXCEPTION 'Item unavailable';
    END IF;
    v_total := v_total + v_menu.price_cents * GREATEST(1, LEAST((v_item->>'quantity')::int, 20));
  END LOOP;

  INSERT INTO public.orders (restaurant_id, table_id, status, guest_name, total_cents)
  VALUES (v_table.restaurant_id, v_table.id, 'placed',
          COALESCE(NULLIF(LEFT(p_guest_name, 80), ''), 'Guest'), v_total)
  RETURNING id, access_token INTO v_order_id, v_access_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, name, price_cents INTO v_menu FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes, status)
    VALUES (v_order_id, v_menu.id, v_menu.name, v_menu.price_cents,
            GREATEST(1, LEAST((v_item->>'quantity')::int, 20)),
            NULLIF(LEFT(COALESCE(v_item->>'notes',''), 300), ''), 'queued');
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'access_token', v_access_token);
END;
$$;
REVOKE ALL ON FUNCTION public.place_guest_order(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_guest_order(text, text, jsonb) TO anon, authenticated;

-- With RPC-based guest ordering, we no longer need permissive anon INSERT policies.
DROP POLICY IF EXISTS "orders guests create validated" ON public.orders;
DROP POLICY IF EXISTS "order_items guests create validated" ON public.order_items;

-- 3. Lock down SECURITY DEFINER function EXECUTE grants (linter findings).
-- Trigger functions must not be callable by clients.
REVOKE ALL ON FUNCTION public.tg_log_reservation_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- check_reservation_capacity: intentionally callable by public /book page, keep anon/authenticated only.
REVOKE ALL ON FUNCTION public.check_reservation_capacity(uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_reservation_capacity(uuid, timestamptz, int) TO anon, authenticated;

-- has_role is used inside RLS policies for authenticated users only.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Guest-scoped SECURITY DEFINER RPCs remain callable by anon (they enforce access_token internally).
REVOKE ALL ON FUNCTION public.get_guest_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_guest_feedback(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_feedback(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_guest_feedback(uuid, text, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(uuid, text, smallint, text) TO anon, authenticated;

-- 4. user_roles: ensure no client-side write path. RLS already denies by default (no INSERT/UPDATE/DELETE policies).
-- Add an explicit restrictive policy to block privilege escalation even if a permissive policy is added later.
DROP POLICY IF EXISTS "user_roles no client writes" ON public.user_roles;
CREATE POLICY "user_roles no client writes"
  ON public.user_roles AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
-- read own roles policy still applies (SELECT permissive), restrictive false blocks writes for anon/authenticated.
-- Since restrictive with USING(false) would also block SELECT, scope it to write ops only via a second permissive read policy already present.
-- Actually AS RESTRICTIVE with FOR ALL blocks SELECT too. Recreate scoped to write commands:
DROP POLICY IF EXISTS "user_roles no client writes" ON public.user_roles;
CREATE POLICY "user_roles block insert" ON public.user_roles AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "user_roles block update" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "user_roles block delete" ON public.user_roles AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
