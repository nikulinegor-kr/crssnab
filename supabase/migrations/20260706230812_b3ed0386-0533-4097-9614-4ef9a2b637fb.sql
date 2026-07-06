CREATE TABLE public.ai_day_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  buckets JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_day_briefs TO authenticated;
GRANT ALL ON public.ai_day_briefs TO service_role;

ALTER TABLE public.ai_day_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view day briefs"
  ON public.ai_day_briefs FOR SELECT
  TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members can insert day briefs"
  ON public.ai_day_briefs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_org_access(auth.uid(), organization_id)
    AND created_by = auth.uid()
  );

CREATE INDEX ai_day_briefs_org_date_idx
  ON public.ai_day_briefs(organization_id, brief_date DESC, generated_at DESC);
