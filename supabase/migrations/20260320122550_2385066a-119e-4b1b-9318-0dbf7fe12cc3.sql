
-- Table to store KP suppliers linked to a folder
CREATE TABLE public.kp_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.material_folders(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT NOT NULL DEFAULT 'xlsx',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store per-supplier prices for each material item
CREATE TABLE public.kp_supplier_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kp_supplier_id UUID NOT NULL REFERENCES public.kp_suppliers(id) ON DELETE CASCADE,
  material_item_id UUID NOT NULL REFERENCES public.material_statement_items(id) ON DELETE CASCADE,
  price NUMERIC,
  total_price NUMERIC,
  match_type TEXT DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kp_supplier_id, material_item_id)
);

-- RLS
ALTER TABLE public.kp_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kp_supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org kp_suppliers" ON public.kp_suppliers
  FOR SELECT TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org kp_suppliers" ON public.kp_suppliers
  FOR INSERT TO authenticated WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org kp_suppliers" ON public.kp_suppliers
  FOR UPDATE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org kp_suppliers" ON public.kp_suppliers
  FOR DELETE TO authenticated USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can view kp_supplier_prices" ON public.kp_supplier_prices
  FOR SELECT TO authenticated USING (
    kp_supplier_id IN (SELECT id FROM public.kp_suppliers WHERE user_has_org_access(auth.uid(), organization_id))
  );

CREATE POLICY "Users can create kp_supplier_prices" ON public.kp_supplier_prices
  FOR INSERT TO authenticated WITH CHECK (
    kp_supplier_id IN (SELECT id FROM public.kp_suppliers WHERE user_has_org_access(auth.uid(), organization_id))
  );

CREATE POLICY "Users can update kp_supplier_prices" ON public.kp_supplier_prices
  FOR UPDATE TO authenticated USING (
    kp_supplier_id IN (SELECT id FROM public.kp_suppliers WHERE user_has_org_access(auth.uid(), organization_id))
  );

CREATE POLICY "Users can delete kp_supplier_prices" ON public.kp_supplier_prices
  FOR DELETE TO authenticated USING (
    kp_supplier_id IN (SELECT id FROM public.kp_suppliers WHERE user_has_org_access(auth.uid(), organization_id))
  );
