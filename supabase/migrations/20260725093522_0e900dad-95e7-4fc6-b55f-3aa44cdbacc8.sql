
-- Reservation audit log (RBAC: staff read only)
CREATE TABLE public.reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  actor_id UUID,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reservation_events TO authenticated;
GRANT ALL ON public.reservation_events TO service_role;

ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read reservation events"
  ON public.reservation_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'host') OR
    public.has_role(auth.uid(), 'waiter')
  );

CREATE INDEX reservation_events_res_idx ON public.reservation_events (reservation_id, created_at DESC);
CREATE INDEX reservation_events_rest_idx ON public.reservation_events (restaurant_id, created_at DESC);

-- Trigger: log every insert/update/delete on reservations
CREATE OR REPLACE FUNCTION public.tg_log_reservation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.reservation_events (reservation_id, restaurant_id, actor_id, event_type, to_status, details)
    VALUES (NEW.id, NEW.restaurant_id, v_actor, 'created', NEW.status,
      jsonb_build_object('guest_name', NEW.guest_name, 'party_size', NEW.party_size, 'requested_at', NEW.requested_at));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.reservation_events (reservation_id, restaurant_id, actor_id, event_type, from_status, to_status, details)
      VALUES (NEW.id, NEW.restaurant_id, v_actor, 'status_change', OLD.status, NEW.status,
        jsonb_build_object('table_id', NEW.table_id));
    ELSIF NEW.table_id IS DISTINCT FROM OLD.table_id THEN
      INSERT INTO public.reservation_events (reservation_id, restaurant_id, actor_id, event_type, details)
      VALUES (NEW.id, NEW.restaurant_id, v_actor, 'table_assigned',
        jsonb_build_object('old_table', OLD.table_id, 'new_table', NEW.table_id));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.reservation_events (reservation_id, restaurant_id, actor_id, event_type, from_status, details)
    VALUES (OLD.id, OLD.restaurant_id, v_actor, 'deleted', OLD.status,
      jsonb_build_object('guest_name', OLD.guest_name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_log_reservation_event() FROM anon, authenticated;

CREATE TRIGGER reservations_audit
AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.tg_log_reservation_event();

-- Capacity check for public /book: returns total_seats, seats_booked in +/- 90m window, seats_available
CREATE OR REPLACE FUNCTION public.check_reservation_capacity(p_restaurant_id UUID, p_requested_at TIMESTAMPTZ, p_party_size INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_booked INT;
BEGIN
  SELECT COALESCE(SUM(seats), 0) INTO v_total FROM public.dining_tables WHERE restaurant_id = p_restaurant_id;
  SELECT COALESCE(SUM(party_size), 0) INTO v_booked
    FROM public.reservations
   WHERE restaurant_id = p_restaurant_id
     AND status IN ('pending','confirmed','seated')
     AND requested_at BETWEEN p_requested_at - interval '90 minutes'
                         AND p_requested_at + interval '90 minutes';
  RETURN jsonb_build_object(
    'total_seats', v_total,
    'seats_booked', v_booked,
    'seats_available', GREATEST(v_total - v_booked, 0),
    'can_book', (v_total - v_booked) >= p_party_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_reservation_capacity(UUID, TIMESTAMPTZ, INT) TO anon, authenticated;

-- Enable realtime for the audit table
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_events;
