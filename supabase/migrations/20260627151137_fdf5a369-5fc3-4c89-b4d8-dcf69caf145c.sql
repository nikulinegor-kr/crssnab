
CREATE TABLE IF NOT EXISTS public.ai_analytics_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  summary text,
  content text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analytics_reports TO authenticated;
GRANT ALL ON public.ai_analytics_reports TO service_role;

ALTER TABLE public.ai_analytics_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view AI analytics reports"
  ON public.ai_analytics_reports FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members can create AI analytics reports"
  ON public.ai_analytics_reports FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Authors or admins can update AI analytics reports"
  ON public.ai_analytics_reports FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Authors or admins can delete AI analytics reports"
  ON public.ai_analytics_reports FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.user_is_org_admin(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_ai_analytics_reports_org_created
  ON public.ai_analytics_reports (organization_id, created_at DESC);
