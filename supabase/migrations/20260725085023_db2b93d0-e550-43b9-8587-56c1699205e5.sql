
DROP POLICY "Staff can update incidents" ON public.incidents;
CREATE POLICY "Staff can update incidents" ON public.incidents FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter')
);
