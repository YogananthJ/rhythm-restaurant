-- 1) Validate guest-supplied contact data on reservation inserts
DROP POLICY IF EXISTS "Anyone can create a reservation" ON public.reservations;
CREATE POLICY "Anyone can create a reservation"
ON public.reservations FOR INSERT TO anon, authenticated
WITH CHECK (
  length(guest_name) >= 1 AND length(guest_name) <= 80
  AND party_size >= 1 AND party_size <= 30
  AND requested_at > (now() - interval '1 hour')
  AND requested_at < (now() + interval '90 days')
  AND status = 'pending'
  AND table_id IS NULL
  AND (email IS NULL OR (length(email) <= 160 AND email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'))
  AND (phone IS NULL OR (length(phone) BETWEEN 6 AND 20 AND phone ~ '^\+?[0-9 ()-]+$'))
  AND (notes IS NULL OR length(notes) <= 280)
);

-- 2) Remove anon (signed-out) grants on staff-only realtime tables.
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.coupons FROM anon;
REVOKE ALL ON public.incidents FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.reservation_events FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.waitlist FROM anon;
REVOKE ALL ON public.guest_feedback FROM anon;
REVOKE ALL ON public.guest_favorites FROM anon;

-- keep service_role full access for privileged server code
GRANT ALL ON public.payments, public.coupons, public.incidents, public.notifications,
  public.reservation_events, public.user_roles, public.profiles, public.orders,
  public.order_items, public.waitlist, public.guest_feedback, public.guest_favorites
  TO service_role;

-- guests only submit reservations; they never read them back directly
REVOKE SELECT, UPDATE, DELETE ON public.reservations FROM anon;
GRANT INSERT ON public.reservations TO anon;
