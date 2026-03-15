
-- Create material_folders table
CREATE TABLE public.material_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES public.material_objects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to material_statements
ALTER TABLE public.material_statements
  ADD COLUMN folder_id UUID REFERENCES public.material_folders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.material_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for material_folders
CREATE POLICY "Users can view org folders"
  ON public.material_folders FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org folders"
  ON public.material_folders FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org folders"
  ON public.material_folders FOR UPDATE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org folders"
  ON public.material_folders FOR DELETE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));
