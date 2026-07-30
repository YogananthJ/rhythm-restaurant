CREATE TABLE public.ai_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  feature text NOT NULL,
  prompt text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  response text,
  outcome text NOT NULL DEFAULT 'answered',
  block_reason text,
  model text,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_audit_log_restaurant_created_idx ON public.ai_audit_log (restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_audit_log TO authenticated;
GRANT ALL ON public.ai_audit_log TO service_role;

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ai audit log" ON public.ai_audit_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
  OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter')
  OR public.has_role(auth.uid(),'kitchen')
);

CREATE POLICY "Staff can insert ai audit log" ON public.ai_audit_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'host') OR public.has_role(auth.uid(),'waiter')
    OR public.has_role(auth.uid(),'kitchen')
  )
);