
-- Table: material statements (one per uploaded PDF/Excel)
CREATE TABLE public.material_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'pdf', -- pdf or xlsx
  is_recognized boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org statements" ON public.material_statements
  FOR SELECT TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org statements" ON public.material_statements
  FOR INSERT TO authenticated WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org statements" ON public.material_statements
  FOR UPDATE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org statements" ON public.material_statements
  FOR DELETE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

-- Table: recognized material items
CREATE TABLE public.material_statement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.material_statements(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  type_mark text,
  unit text,
  quantity numeric,
  mass_per_unit numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_statement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org items" ON public.material_statement_items
  FOR SELECT TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org items" ON public.material_statement_items
  FOR INSERT TO authenticated WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org items" ON public.material_statement_items
  FOR UPDATE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org items" ON public.material_statement_items
  FOR DELETE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

-- Storage bucket for statement files
INSERT INTO storage.buckets (id, name, public) VALUES ('material-statements', 'material-statements', true);

CREATE POLICY "Users can upload statement files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'material-statements');

CREATE POLICY "Users can view statement files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'material-statements');

CREATE POLICY "Users can delete statement files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'material-statements');

-- Trigger for updated_at
CREATE TRIGGER update_material_statements_updated_at
  BEFORE UPDATE ON public.material_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_statement_items_updated_at
  BEFORE UPDATE ON public.material_statement_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set created_by
CREATE TRIGGER set_material_statements_created_by
  BEFORE INSERT ON public.material_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
