
-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID,  -- null = broadcast to all staff in restaurant
  category TEXT NOT NULL DEFAULT 'system',  -- order, kitchen, reservation, incident, billing, system
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,           -- in-app route to open on click
  group_key TEXT,      -- collapse duplicates
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_restaurant_created_idx ON public.notifications(restaurant_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(restaurant_id, read_at) WHERE dismissed_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'waiter') OR has_role(auth.uid(),'kitchen')
    OR has_role(auth.uid(),'host')
  );

CREATE POLICY "staff mark notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'waiter') OR has_role(auth.uid(),'kitchen')
    OR has_role(auth.uid(),'host')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Notification helper
CREATE OR REPLACE FUNCTION public.push_notification(
  p_restaurant_id UUID, p_category TEXT, p_priority TEXT,
  p_title TEXT, p_body TEXT, p_link TEXT, p_group_key TEXT, p_data JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  -- collapse: if same group_key exists unread within 5 minutes, bump it instead
  IF p_group_key IS NOT NULL THEN
    UPDATE public.notifications
       SET data = COALESCE(data,'{}'::jsonb) || COALESCE(p_data,'{}'::jsonb),
           title = p_title,
           body = p_body,
           priority = p_priority,
           created_at = now(),
           read_at = NULL
     WHERE restaurant_id = p_restaurant_id
       AND group_key = p_group_key
       AND dismissed_at IS NULL
       AND created_at > now() - interval '5 minutes'
     RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  INSERT INTO public.notifications (restaurant_id, category, priority, title, body, link, group_key, data)
  VALUES (p_restaurant_id, p_category, p_priority, p_title, p_body, p_link, p_group_key, COALESCE(p_data,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Staff RPCs
CREATE OR REPLACE FUNCTION public.notify_mark_read(p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET read_at = COALESCE(read_at, now()) WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_mark_all_read(p_restaurant_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET read_at = COALESCE(read_at, now())
   WHERE restaurant_id = p_restaurant_id AND read_at IS NULL AND dismissed_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_dismiss(p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET dismissed_at = now(), read_at = COALESCE(read_at, now()) WHERE id = p_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.push_notification(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mark_read(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_mark_all_read(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_dismiss(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_mark_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_mark_all_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_dismiss(UUID) TO authenticated;

-- Auto-generate notifications from events
CREATE OR REPLACE FUNCTION public.tg_notify_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table TEXT;
BEGIN
  SELECT label INTO v_table FROM public.dining_tables WHERE id = NEW.table_id;
  PERFORM public.push_notification(
    NEW.restaurant_id, 'order', 'high',
    'New order · Table ' || COALESCE(v_table,'?'),
    COALESCE(NEW.guest_name,'Guest') || ' placed an order',
    '/dashboard',
    'new_order_' || NEW.id::text,
    jsonb_build_object('order_id', NEW.id, 'table_id', NEW.table_id)
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_order_insert();

CREATE OR REPLACE FUNCTION public.tg_notify_order_item_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ord RECORD; v_table TEXT;
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
    SELECT o.*, t.label AS table_label INTO v_ord
      FROM public.orders o LEFT JOIN public.dining_tables t ON t.id = o.table_id
     WHERE o.id = NEW.order_id;
    PERFORM public.push_notification(
      v_ord.restaurant_id, 'kitchen', 'high',
      'Ready to run · Table ' || COALESCE(v_ord.table_label,'?'),
      NEW.name_snapshot || ' × ' || NEW.quantity,
      '/kds',
      'ready_' || NEW.order_id::text,
      jsonb_build_object('order_id', NEW.order_id, 'item_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_item_ready AFTER UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_order_item_ready();

CREATE OR REPLACE FUNCTION public.tg_notify_reservation_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(
    NEW.restaurant_id, 'reservation', 'normal',
    'New reservation · ' || NEW.guest_name,
    'Party of ' || NEW.party_size || ' · ' || to_char(NEW.requested_at,'Mon DD HH24:MI'),
    '/host',
    'new_res_' || NEW.id::text,
    jsonb_build_object('reservation_id', NEW.id)
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_res AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_reservation_insert();

CREATE OR REPLACE FUNCTION public.tg_notify_incident_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(
    NEW.restaurant_id, 'incident',
    CASE WHEN NEW.priority = 'critical' THEN 'urgent'
         WHEN NEW.priority = 'high' THEN 'high'
         ELSE 'normal' END,
    'Incident · ' || NEW.title,
    LEFT(COALESCE(NEW.business_impact,''), 160),
    '/intel',
    'incident_' || NEW.fingerprint,
    jsonb_build_object('incident_id', NEW.id, 'priority', NEW.priority)
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_incident AFTER INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_incident_insert();

-- ============ MENU ITEM METADATA FOR RECOMMENDATIONS ============
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS popularity_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_boost NUMERIC NOT NULL DEFAULT 0;

-- ============ GUEST FAVORITES (per QR token) ============
CREATE TABLE public.guest_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(qr_token, menu_item_id)
);
CREATE INDEX guest_favorites_token_idx ON public.guest_favorites(qr_token);
GRANT SELECT, INSERT, DELETE ON public.guest_favorites TO authenticated;
GRANT ALL ON public.guest_favorites TO service_role;
ALTER TABLE public.guest_favorites ENABLE ROW LEVEL SECURITY;
-- Only service_role touches it directly; access via RPCs.
CREATE POLICY "no direct access favorites"
  ON public.guest_favorites FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.toggle_guest_favorite(p_qr_token TEXT, p_menu_item_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rid UUID; v_exists UUID;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.dining_tables WHERE qr_token = p_qr_token;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Invalid table'; END IF;
  SELECT id INTO v_exists FROM public.guest_favorites
    WHERE qr_token = p_qr_token AND menu_item_id = p_menu_item_id;
  IF v_exists IS NOT NULL THEN
    DELETE FROM public.guest_favorites WHERE id = v_exists;
    RETURN FALSE;
  END IF;
  INSERT INTO public.guest_favorites(qr_token, restaurant_id, menu_item_id)
    VALUES (p_qr_token, v_rid, p_menu_item_id);
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.list_guest_favorites(p_qr_token TEXT)
RETURNS TABLE(menu_item_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT menu_item_id FROM public.guest_favorites WHERE qr_token = p_qr_token;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_guest_favorite(TEXT,UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_guest_favorites(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_guest_favorite(TEXT,UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_guest_favorites(TEXT) TO anon, authenticated;

-- ============ RECOMMENDATION ENGINE ============
-- Returns ranked available items with reason tags.
CREATE OR REPLACE FUNCTION public.get_recommendations(
  p_qr_token TEXT,
  p_cart_item_ids UUID[] DEFAULT '{}',
  p_dietary TEXT[] DEFAULT '{}',
  p_limit INT DEFAULT 6
)
RETURNS TABLE(
  menu_item_id UUID,
  name TEXT,
  description TEXT,
  price_cents INT,
  prep_minutes INT,
  category_id UUID,
  dietary_tags TEXT[],
  score NUMERIC,
  reasons TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rid UUID;
  v_hour INT := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
  v_seated INT;
  v_total_tables INT;
  v_busy BOOLEAN;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.dining_tables WHERE qr_token = p_qr_token;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Invalid table'; END IF;

  SELECT COUNT(*) FILTER (WHERE status IN ('occupied','seated')),
         COUNT(*)
    INTO v_seated, v_total_tables
    FROM public.dining_tables WHERE restaurant_id = v_rid;
  v_busy := v_total_tables > 0 AND (v_seated::numeric / v_total_tables) >= 0.6;

  RETURN QUERY
  WITH base AS (
    SELECT mi.id, mi.name, mi.description, mi.price_cents, mi.prep_minutes,
           mi.category_id, mi.dietary_tags, mi.allergens,
           mi.popularity_score, mi.promo_boost
      FROM public.menu_items mi
     WHERE mi.restaurant_id = v_rid AND mi.is_available = true
       AND NOT (mi.id = ANY(COALESCE(p_cart_item_ids,'{}')))
       AND (
         COALESCE(array_length(p_dietary,1),0) = 0
         OR p_dietary <@ mi.dietary_tags
       )
  ),
  -- trending: units sold in last 24h across restaurant
  trending AS (
    SELECT oi.menu_item_id, SUM(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = v_rid
       AND o.created_at > now() - interval '24 hours'
       AND oi.status <> 'cancelled'
     GROUP BY oi.menu_item_id
  ),
  -- time-of-day affinity: units sold in same +/-2h window over last 14 days
  timeaff AS (
    SELECT oi.menu_item_id, SUM(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = v_rid
       AND o.created_at > now() - interval '14 days'
       AND ABS(EXTRACT(HOUR FROM o.created_at) - v_hour) <= 2
       AND oi.status <> 'cancelled'
     GROUP BY oi.menu_item_id
  ),
  -- favorites bump for this QR token
  favs AS (
    SELECT menu_item_id FROM public.guest_favorites WHERE qr_token = p_qr_token
  ),
  -- co-purchase: items frequently ordered with items currently in cart
  copurchase AS (
    SELECT oi2.menu_item_id, COUNT(*)::numeric AS n
      FROM public.order_items oi1
      JOIN public.order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.menu_item_id <> oi1.menu_item_id
      JOIN public.orders o ON o.id = oi1.order_id
     WHERE o.restaurant_id = v_rid
       AND oi1.menu_item_id = ANY(COALESCE(p_cart_item_ids,'{}'))
       AND o.created_at > now() - interval '60 days'
     GROUP BY oi2.menu_item_id
  ),
  -- prior orders from this same QR token
  history AS (
    SELECT oi.menu_item_id, SUM(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.dining_tables t ON t.id = o.table_id
     WHERE t.qr_token = p_qr_token
       AND o.created_at > now() - interval '90 days'
       AND oi.status <> 'cancelled'
     GROUP BY oi.menu_item_id
  ),
  scored AS (
    SELECT b.*,
      COALESCE(t.units,0) AS trend_units,
      COALESCE(ta.units,0) AS time_units,
      COALESCE(cp.n,0) AS copurchase_n,
      COALESCE(h.units,0) AS history_units,
      (f.menu_item_id IS NOT NULL) AS is_fav,
      -- score composition
      (
        COALESCE(t.units,0) * 1.2
        + COALESCE(ta.units,0) * 1.5
        + COALESCE(cp.n,0) * 2.0
        + COALESCE(h.units,0) * 1.8
        + CASE WHEN f.menu_item_id IS NOT NULL THEN 5 ELSE 0 END
        + b.popularity_score
        + b.promo_boost * 1.5
        + CASE WHEN v_busy AND b.prep_minutes <= 10 THEN 2 ELSE 0 END
      ) AS raw_score
      FROM base b
      LEFT JOIN trending t ON t.menu_item_id = b.id
      LEFT JOIN timeaff ta ON ta.menu_item_id = b.id
      LEFT JOIN copurchase cp ON cp.menu_item_id = b.id
      LEFT JOIN history h ON h.menu_item_id = b.id
      LEFT JOIN favs f ON f.menu_item_id = b.id
  )
  SELECT
    s.id,
    s.name,
    s.description,
    s.price_cents,
    s.prep_minutes,
    s.category_id,
    s.dietary_tags,
    ROUND(s.raw_score::numeric, 2) AS score,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN s.is_fav THEN 'Your favorite' END,
      CASE WHEN s.history_units > 0 THEN 'You ordered before' END,
      CASE WHEN s.copurchase_n > 0 THEN 'Pairs with your cart' END,
      CASE WHEN s.time_units > 0 THEN 'Popular right now' END,
      CASE WHEN s.trend_units > 0 THEN 'Trending today' END,
      CASE WHEN s.promo_boost > 0 THEN 'Chef''s pick' END,
      CASE WHEN v_busy AND s.prep_minutes <= 10 THEN 'Quick to prep' END
    ], NULL) AS reasons
  FROM scored s
  WHERE s.raw_score > 0 OR s.popularity_score > 0
  ORDER BY s.raw_score DESC, s.popularity_score DESC, s.name
  LIMIT GREATEST(1, LEAST(p_limit, 20));
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_recommendations(TEXT,UUID[],TEXT[],INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_recommendations(TEXT,UUID[],TEXT[],INT) TO anon, authenticated;

-- Seed some tags & promo boost so recs have signal on day one
UPDATE public.menu_items SET dietary_tags = ARRAY['vegetarian']
  WHERE dietary_tags = '{}' AND (name ILIKE '%veg%' OR name ILIKE '%paneer%' OR name ILIKE '%salad%' OR name ILIKE '%risotto%');
UPDATE public.menu_items SET promo_boost = 3 WHERE promo_boost = 0 AND random() < 0.15;
UPDATE public.menu_items SET popularity_score = ROUND((random()*10)::numeric, 2) WHERE popularity_score = 0;
