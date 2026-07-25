
CREATE TABLE public.guest_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  sentiment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_feedback TO authenticated;
GRANT ALL ON public.guest_feedback TO service_role;

ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Staff can read feedback for their restaurant
CREATE POLICY "Staff read feedback" ON public.guest_feedback
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'waiter')
  OR public.has_role(auth.uid(), 'host')
  OR public.has_role(auth.uid(), 'kitchen')
);

-- Guest submits via SECURITY DEFINER RPC, so no anon insert policy needed.

CREATE OR REPLACE FUNCTION public.submit_guest_feedback(
  p_order_id UUID,
  p_access_token TEXT,
  p_rating SMALLINT,
  p_comment TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_id UUID;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;
  SELECT id, restaurant_id, access_token, created_at INTO v_order
  FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.access_token IS DISTINCT FROM p_access_token THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF v_order.created_at < now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Feedback window closed';
  END IF;

  INSERT INTO public.guest_feedback (order_id, restaurant_id, rating, comment,
    sentiment)
  VALUES (p_order_id, v_order.restaurant_id, p_rating,
    NULLIF(LEFT(COALESCE(p_comment,''), 500), ''),
    CASE WHEN p_rating >= 4 THEN 'positive'
         WHEN p_rating = 3 THEN 'neutral'
         ELSE 'negative' END)
  ON CONFLICT (order_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        sentiment = EXCLUDED.sentiment,
        created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_guest_feedback(UUID, TEXT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(UUID, TEXT, SMALLINT, TEXT) TO anon, authenticated;

-- Allow the guest tracker to check whether feedback already exists (returns row count only).
CREATE OR REPLACE FUNCTION public.get_guest_feedback(
  p_order_id UUID,
  p_access_token TEXT
) RETURNS TABLE (rating SMALLINT, comment TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT access_token INTO v_token FROM public.orders WHERE id = p_order_id;
  IF v_token IS NULL OR v_token IS DISTINCT FROM p_access_token THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  RETURN QUERY
    SELECT gf.rating, gf.comment, gf.created_at
    FROM public.guest_feedback gf WHERE gf.order_id = p_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_guest_feedback(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_feedback(UUID, TEXT) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_feedback;
