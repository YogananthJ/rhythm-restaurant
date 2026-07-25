
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  party_size INT NOT NULL DEFAULT 2 CHECK (party_size BETWEEN 1 AND 30),
  requested_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','seated','cancelled','no_show')),
  notes TEXT,
  table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reservations_restaurant_time_idx ON public.reservations(restaurant_id, requested_at DESC);
CREATE INDEX reservations_status_idx ON public.reservations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT INSERT ON public.reservations TO anon;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon guests) can create a reservation, but only with sane input
CREATE POLICY "Anyone can create a reservation"
  ON public.reservations FOR INSERT
  WITH CHECK (
    length(guest_name) BETWEEN 1 AND 80
    AND party_size BETWEEN 1 AND 30
    AND requested_at > now() - interval '1 hour'
    AND requested_at < now() + interval '90 days'
    AND status = 'pending'
    AND table_id IS NULL
  );

-- Staff can view / update / delete
CREATE POLICY "Staff can view reservations"
  ON public.reservations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'host')
    OR public.has_role(auth.uid(),'waiter')
  );

CREATE POLICY "Staff can update reservations"
  ON public.reservations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'host')
    OR public.has_role(auth.uid(),'waiter')
  );

CREATE POLICY "Staff can delete reservations"
  ON public.reservations FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
  );

CREATE TRIGGER touch_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
