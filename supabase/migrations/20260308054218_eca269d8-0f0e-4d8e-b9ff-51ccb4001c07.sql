
-- Create equipment table
CREATE TABLE public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, brand, model)
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org equipment" ON public.equipment
  FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org equipment" ON public.equipment
  FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org equipment" ON public.equipment
  FOR UPDATE USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete org equipment" ON public.equipment
  FOR DELETE USING (user_is_org_admin(auth.uid(), organization_id));

-- Add equipment_id to warehouse_products
ALTER TABLE public.warehouse_products
  ADD COLUMN equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL;
