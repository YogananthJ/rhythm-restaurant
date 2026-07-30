CREATE OR REPLACE FUNCTION public.get_recommendations(p_qr_token text, p_cart_item_ids uuid[] DEFAULT '{}'::uuid[], p_dietary text[] DEFAULT '{}'::text[], p_limit integer DEFAULT 6)
 RETURNS TABLE(menu_item_id uuid, name text, description text, price_cents integer, prep_minutes integer, category_id uuid, dietary_tags text[], score numeric, reasons text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rid UUID;
  v_hour INT := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
  v_seated INT;
  v_total_tables INT;
  v_busy BOOLEAN;
BEGIN
  SELECT t.restaurant_id INTO v_rid FROM public.dining_tables t WHERE t.qr_token = p_qr_token;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Invalid table'; END IF;

  SELECT COUNT(*) FILTER (WHERE t.status IN ('occupied','seated')), COUNT(*)
    INTO v_seated, v_total_tables
    FROM public.dining_tables t WHERE t.restaurant_id = v_rid;
  v_busy := v_total_tables > 0 AND (v_seated::numeric / v_total_tables) >= 0.6;

  RETURN QUERY
  WITH base AS (
    SELECT mi.id, mi.name, mi.description, mi.price_cents, mi.prep_minutes,
           mi.category_id, mi.dietary_tags, mi.popularity_score, mi.promo_boost
      FROM public.menu_items mi
     WHERE mi.restaurant_id = v_rid AND mi.is_available = true
       AND NOT (mi.id = ANY(COALESCE(p_cart_item_ids,'{}')))
       AND (COALESCE(array_length(p_dietary,1),0) = 0 OR p_dietary <@ mi.dietary_tags)
  ),
  trending AS (
    SELECT oi.menu_item_id AS mid, SUM(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = v_rid
       AND o.created_at > now() - interval '24 hours'
       AND oi.status <> 'cancelled'
     GROUP BY oi.menu_item_id
  ),
  timeaff AS (
    SELECT oi.menu_item_id AS mid, SUM(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = v_rid
       AND o.created_at > now() - interval '14 days'
       AND ABS(EXTRACT(HOUR FROM o.created_at) - v_hour) <= 2
       AND oi.status <> 'cancelled'
     GROUP BY oi.menu_item_id
  ),
  favs AS (
    SELECT gf.menu_item_id AS mid FROM public.guest_favorites gf WHERE gf.qr_token = p_qr_token
  ),
  copurchase AS (
    SELECT oi2.menu_item_id AS mid, COUNT(*)::numeric AS n
      FROM public.order_items oi1
      JOIN public.order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.menu_item_id <> oi1.menu_item_id
      JOIN public.orders o ON o.id = oi1.order_id
     WHERE o.restaurant_id = v_rid
       AND oi1.menu_item_id = ANY(COALESCE(p_cart_item_ids,'{}'))
       AND o.created_at > now() - interval '60 days'
     GROUP BY oi2.menu_item_id
  ),
  history AS (
    SELECT oi.menu_item_id AS mid, SUM(oi.quantity)::numeric AS units
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
      COALESCE(cp.n,0) AS copurchase_n,
      COALESCE(h.units,0) AS history_units,
      COALESCE(t.units,0) AS trend_units,
      COALESCE(ta.units,0) AS time_units,
      (f.mid IS NOT NULL) AS is_fav,
      (
        COALESCE(t.units,0) * 1.2
        + COALESCE(ta.units,0) * 1.5
        + COALESCE(cp.n,0) * 2.0
        + COALESCE(h.units,0) * 1.8
        + CASE WHEN f.mid IS NOT NULL THEN 5 ELSE 0 END
        + b.popularity_score
        + b.promo_boost * 1.5
        + CASE WHEN v_busy AND b.prep_minutes <= 10 THEN 2 ELSE 0 END
      ) AS raw_score
      FROM base b
      LEFT JOIN trending t ON t.mid = b.id
      LEFT JOIN timeaff ta ON ta.mid = b.id
      LEFT JOIN copurchase cp ON cp.mid = b.id
      LEFT JOIN history h ON h.mid = b.id
      LEFT JOIN favs f ON f.mid = b.id
  )
  SELECT
    s.id, s.name, s.description, s.price_cents, s.prep_minutes,
    s.category_id, s.dietary_tags,
    ROUND(s.raw_score::numeric, 2),
    ARRAY_REMOVE(ARRAY[
      CASE WHEN s.is_fav THEN 'Your favorite' END,
      CASE WHEN s.history_units > 0 THEN 'You ordered before' END,
      CASE WHEN s.copurchase_n > 0 THEN 'Pairs with your cart' END,
      CASE WHEN s.time_units > 0 THEN 'Popular right now' END,
      CASE WHEN s.trend_units > 0 THEN 'Trending today' END,
      CASE WHEN s.promo_boost > 0 THEN 'Chef''s pick' END,
      CASE WHEN v_busy AND s.prep_minutes <= 10 THEN 'Quick to prep' END
    ], NULL)
  FROM scored s
  WHERE s.raw_score > 0 OR s.popularity_score > 0
  ORDER BY s.raw_score DESC, s.popularity_score DESC, s.name
  LIMIT GREATEST(1, LEAST(p_limit, 20));
END; $function$;