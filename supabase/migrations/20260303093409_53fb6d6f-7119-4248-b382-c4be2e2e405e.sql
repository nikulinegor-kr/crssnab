
-- Create procurements table
CREATE TABLE public.procurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  created_by UUID REFERENCES auth.users(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create procurement_items table
CREATE TABLE public.procurement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  procurement_id UUID NOT NULL REFERENCES public.procurements(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.requests(id),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_items ENABLE ROW LEVEL SECURITY;

-- RLS for procurements
CREATE POLICY "Users can view org procurements"
ON public.procurements FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org procurements"
ON public.procurements FOR INSERT
WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org procurements"
ON public.procurements FOR UPDATE
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete org procurements"
ON public.procurements FOR DELETE
USING (user_is_org_admin(auth.uid(), organization_id));

-- RLS for procurement_items
CREATE POLICY "Users can view procurement items"
ON public.procurement_items FOR SELECT
USING (procurement_id IN (
  SELECT id FROM public.procurements WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can insert procurement items"
ON public.procurement_items FOR INSERT
WITH CHECK (procurement_id IN (
  SELECT id FROM public.procurements WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can update procurement items"
ON public.procurement_items FOR UPDATE
USING (procurement_id IN (
  SELECT id FROM public.procurements WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can delete procurement items"
ON public.procurement_items FOR DELETE
USING (procurement_id IN (
  SELECT id FROM public.procurements WHERE user_has_org_access(auth.uid(), organization_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_procurements_updated_at
BEFORE UPDATE ON public.procurements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
