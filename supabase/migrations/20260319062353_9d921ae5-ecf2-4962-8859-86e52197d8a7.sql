ALTER TABLE public.material_statements
  ADD COLUMN IF NOT EXISTS classification_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS detected_doc_type text DEFAULT NULL;

CREATE TABLE public.classification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pattern text NOT NULL,
  section_name text NOT NULL,
  doc_type text DEFAULT 'statement',
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, pattern)
);

ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage classification rules for their org"
  ON public.classification_rules
  FOR ALL
  TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));

CREATE INDEX idx_material_statements_classification ON public.material_statements(organization_id, classification_status)
  WHERE classification_status IS NOT NULL;