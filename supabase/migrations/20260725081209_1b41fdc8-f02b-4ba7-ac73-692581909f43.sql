
-- 1. Add access_token to orders (guest capability token)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex');

-- 2. Replace public SELECT policies with staff-only
DROP POLICY IF EXISTS "orders public read" ON public.orders;
DROP POLICY IF EXISTS "order_items public read" ON public.order_items;

CREATE POLICY "staff read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
    OR public.has_role(auth.uid(), 'host')
  );

CREATE POLICY "staff read order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
    OR public.has_role(auth.uid(), 'host')
  );

-- 3. Ownership-checked guest INSERT policies
DROP POLICY IF EXISTS "orders guests can create" ON public.orders;
CREATE POLICY "orders guests create validated" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    table_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.dining_tables dt
      WHERE dt.id = orders.table_id
        AND dt.restaurant_id = orders.restaurant_id
    )
    AND status = 'placed'
    AND total_cents >= 0
    AND total_cents < 1000000
  );

DROP POLICY IF EXISTS "order_items guests create" ON public.order_items;
CREATE POLICY "order_items guests create validated" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.status IN ('placed', 'preparing')
        AND o.created_at > (now() - interval '30 minutes')
    )
    AND quantity > 0
    AND quantity <= 50
    AND unit_price_cents >= 0
  );

-- 4. Staff UPDATE policies: replace WITH CHECK (true)
DROP POLICY IF EXISTS "staff update orders" ON public.orders;
CREATE POLICY "staff update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
  );

DROP POLICY IF EXISTS "staff update order_items" ON public.order_items;
CREATE POLICY "staff update order_items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'waiter')
  );

-- 5. Profiles readable only to owner or managers/admins
DROP POLICY IF EXISTS "profiles readable to authenticated" ON public.profiles;
CREATE POLICY "profiles readable to self or staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- 6. Fix mutable search_path on the updated-at trigger fn
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 7. Revoke EXECUTE on internal SECURITY DEFINER helpers.
--    `has_role` must stay callable by authenticated (RLS uses it), but revoke from PUBLIC/anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- Trigger-only functions: no external caller should invoke them.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM authenticated;

-- 8. Guest can fetch own order via token-scoped RPC
CREATE OR REPLACE FUNCTION public.get_guest_order(p_order_id uuid, p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order jsonb;
  v_items jsonb;
BEGIN
  SELECT to_jsonb(o) - 'access_token' INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     AND o.access_token = p_access_token;

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at), '[]'::jsonb)
    INTO v_items
    FROM public.order_items oi
   WHERE oi.order_id = p_order_id;

  RETURN jsonb_build_object('order', v_order, 'items', v_items);
END $$;

REVOKE EXECUTE ON FUNCTION public.get_guest_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order(uuid, text) TO anon, authenticated;
