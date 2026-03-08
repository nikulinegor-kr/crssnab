
-- Create object documents table
CREATE TABLE IF NOT EXISTS public.object_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.request_objects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  doc_type text NOT NULL DEFAULT 'Другое',
  name text NOT NULL,
  file_url text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.object_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org object docs" ON public.object_documents
  FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org object docs" ON public.object_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org object docs" ON public.object_documents
  FOR DELETE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

-- Create storage bucket for object documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('object-documents', 'object-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload object docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'object-documents');

CREATE POLICY "Users can view object docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'object-documents');

CREATE POLICY "Users can delete object docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'object-documents');
