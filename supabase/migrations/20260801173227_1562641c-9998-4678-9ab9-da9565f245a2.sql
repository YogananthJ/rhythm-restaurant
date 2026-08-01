-- 1) guest_favorites: explicit deny for all direct writes (writes only via toggle_guest_favorite)
DROP POLICY IF EXISTS "No direct favorite inserts" ON public.guest_favorites;
DROP POLICY IF EXISTS "No direct favorite updates" ON public.guest_favorites;
DROP POLICY IF EXISTS "No direct favorite deletes" ON public.guest_favorites;

CREATE POLICY "No direct favorite inserts" ON public.guest_favorites
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No direct favorite updates" ON public.guest_favorites
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct favorite deletes" ON public.guest_favorites
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 2) reservations: remove direct anonymous INSERT, funnel through a validated RPC
DROP POLICY IF EXISTS "Anyone can create a reservation" ON public.reservations;

CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_restaurant_id uuid,
  p_guest_name text,
  p_phone text,
  p_email text,
  p_party_size integer,
  p_requested_at timestamptz,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_guest_name,'')), '');
  v_phone text := NULLIF(BTRIM(COALESCE(p_phone,'')), '');
  v_email text := NULLIF(BTRIM(COALESCE(p_email,'')), '');
  v_notes text := NULLIF(LEFT(BTRIM(COALESCE(p_notes,'')), 280), '');
  v_party int := COALESCE(p_party_size, 0);
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  IF v_name IS NULL OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Please enter a valid name';
  END IF;
  IF v_party < 1 OR v_party > 30 THEN
    RAISE EXCEPTION 'Party size must be between 1 and 30';
  END IF;
  IF p_requested_at IS NULL
     OR p_requested_at <= now() - interval '1 hour'
     OR p_requested_at >= now() + interval '90 days' THEN
    RAISE EXCEPTION 'Please pick a valid date and time';
  END IF;
  IF v_email IS NOT NULL AND (length(v_email) > 160
      OR v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RAISE EXCEPTION 'Please enter a valid email';
  END IF;
  IF v_phone IS NOT NULL AND (length(v_phone) < 6 OR length(v_phone) > 20
      OR v_phone !~ '^\+?[0-9 ()-]+$') THEN
    RAISE EXCEPTION 'Please enter a valid phone number';
  END IF;

  INSERT INTO public.reservations
    (restaurant_id, guest_name, phone, email, party_size, requested_at, notes, status, table_id)
  VALUES
    (p_restaurant_id, v_name, v_phone, v_email, v_party, p_requested_at, v_notes, 'pending', NULL)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('reservation_id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_reservation(uuid, text, text, text, integer, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_reservation(uuid, text, text, text, integer, timestamptz, text) TO anon, authenticated;