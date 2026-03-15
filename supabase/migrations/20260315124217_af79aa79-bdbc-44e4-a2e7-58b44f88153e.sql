
CREATE TABLE public.material_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org material objects" ON public.material_objects
  FOR SELECT TO authenticated USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can create org material objects" ON public.material_objects
  FOR INSERT TO authenticated WITH CHECK (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can update org material objects" ON public.material_objects
  FOR UPDATE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can delete org material objects" ON public.material_objects
  FOR DELETE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE TRIGGER update_material_objects_updated_at
  BEFORE UPDATE ON public.material_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_material_objects_created_by
  BEFORE INSERT ON public.material_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Update material_statements to reference material_objects instead of request_objects
ALTER TABLE public.material_statements DROP CONSTRAINT IF EXISTS material_statements_object_id_fkey;
ALTER TABLE public.material_statements 
  ADD CONSTRAINT material_statements_object_id_fkey 
  FOREIGN KEY (object_id) REFERENCES public.material_objects(id) ON DELETE SET NULL;
