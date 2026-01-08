-- Create spare parts catalog table
CREATE TABLE public.spare_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  article TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  equipment_type TEXT,
  equipment_model TEXT,
  equipment_number TEXT,
  quantity INTEGER DEFAULT 1,
  price NUMERIC,
  unit TEXT DEFAULT 'шт',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view org spare parts"
ON public.spare_parts
FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org spare parts"
ON public.spare_parts
FOR INSERT
WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org spare parts"
ON public.spare_parts
FOR UPDATE
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete spare parts"
ON public.spare_parts
FOR DELETE
USING (user_is_org_admin(auth.uid(), organization_id));

-- Create index for faster searches
CREATE INDEX idx_spare_parts_article ON public.spare_parts(article);
CREATE INDEX idx_spare_parts_name ON public.spare_parts USING gin(to_tsvector('russian', name));
CREATE INDEX idx_spare_parts_equipment_type ON public.spare_parts(equipment_type);
CREATE INDEX idx_spare_parts_org ON public.spare_parts(organization_id);

-- Create update trigger
CREATE TRIGGER update_spare_parts_updated_at
BEFORE UPDATE ON public.spare_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();