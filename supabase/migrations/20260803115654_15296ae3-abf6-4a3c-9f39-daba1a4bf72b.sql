DROP POLICY IF EXISTS "staff read notifications" ON public.notifications;
DROP POLICY IF EXISTS "staff mark notifications" ON public.notifications;

CREATE POLICY "staff read notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  (user_id IS NULL OR user_id = auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'waiter'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)
    OR has_role(auth.uid(), 'host'::app_role)
  )
);

CREATE POLICY "staff mark notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (
  (user_id IS NULL OR user_id = auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'waiter'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role)
    OR has_role(auth.uid(), 'host'::app_role)
  )
)
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.notify_mark_read(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET read_at = COALESCE(read_at, now())
   WHERE id = p_id AND (user_id IS NULL OR user_id = auth.uid());
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_dismiss(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET dismissed_at = now(), read_at = COALESCE(read_at, now())
   WHERE id = p_id AND (user_id IS NULL OR user_id = auth.uid());
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_mark_all_read(p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._require_staff();
  UPDATE public.notifications SET read_at = COALESCE(read_at, now())
   WHERE restaurant_id = p_restaurant_id AND read_at IS NULL AND dismissed_at IS NULL
     AND (user_id IS NULL OR user_id = auth.uid());
END; $function$;