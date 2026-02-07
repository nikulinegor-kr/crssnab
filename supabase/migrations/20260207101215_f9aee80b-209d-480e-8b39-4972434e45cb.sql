
-- Create deadstock_items table
CREATE TABLE public.deadstock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  part_number TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  responsible_user_id UUID,
  sold_at DATE,
  buyer TEXT,
  invoice_number TEXT,
  tk TEXT,
  shipped_at DATE,
  arrived_at DATE,
  photo_urls TEXT[],
  document_urls TEXT[]
);

-- Enable RLS
ALTER TABLE public.deadstock_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view org deadstock" ON public.deadstock_items
  FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org deadstock" ON public.deadstock_items
  FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org deadstock" ON public.deadstock_items
  FOR UPDATE USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete org deadstock" ON public.deadstock_items
  FOR DELETE USING (user_is_org_admin(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_deadstock_items_updated_at
  BEFORE UPDATE ON public.deadstock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger set created_by
CREATE TRIGGER set_deadstock_created_by
  BEFORE INSERT ON public.deadstock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('deadstock-photos', 'deadstock-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('deadstock-documents', 'deadstock-documents', true);

-- Storage policies for photos
CREATE POLICY "Authenticated users can upload deadstock photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deadstock-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view deadstock photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deadstock-photos');

CREATE POLICY "Authenticated users can update deadstock photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'deadstock-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deadstock photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deadstock-photos' AND auth.uid() IS NOT NULL);

-- Storage policies for documents
CREATE POLICY "Authenticated users can upload deadstock documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deadstock-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view deadstock documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deadstock-documents');

CREATE POLICY "Authenticated users can update deadstock documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'deadstock-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deadstock documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deadstock-documents' AND auth.uid() IS NOT NULL);
