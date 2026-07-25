
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2 CHECK (party_size > 0 AND party_size <= 30),
  phone TEXT,
  notes TEXT,
  quoted_minutes INTEGER NOT NULL DEFAULT 15 CHECK (quoted_minutes >= 0 AND quoted_minutes <= 240),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified','seated','left')),
  seated_table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read waitlist"
  ON public.waitlist FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'host')
    OR public.has_role(auth.uid(), 'waiter')
  );

CREATE POLICY "Staff can insert waitlist"
  ON public.waitlist FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'host')
    OR public.has_role(auth.uid(), 'waiter')
  );

CREATE POLICY "Staff can update waitlist"
  ON public.waitlist FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'host')
    OR public.has_role(auth.uid(), 'waiter')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'host')
    OR public.has_role(auth.uid(), 'waiter')
  );

CREATE POLICY "Managers can delete waitlist"
  ON public.waitlist FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER waitlist_touch_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;
