-- Filter Elements module: catalog, equipment compatibility, movements, deadstock

-- 1. Catalog
CREATE TABLE public.filter_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  manufacturer text,
  name text NOT NULL,
  article text,
  cross_numbers text[] NOT NULL DEFAULT '{}',
  unit text NOT NULL DEFAULT 'шт',
  storage_location text,
  min_stock numeric NOT NULL DEFAULT 0,
  photo_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_elements TO authenticated;
GRANT ALL ON public.filter_elements TO service_role;
ALTER TABLE public.filter_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view filter_elements" ON public.filter_elements
  FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can insert filter_elements" ON public.filter_elements
  FOR INSERT TO authenticated WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can update filter_elements" ON public.filter_elements
  FOR UPDATE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can delete filter_elements" ON public.filter_elements
  FOR DELETE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE TRIGGER filter_elements_updated_at BEFORE UPDATE ON public.filter_elements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER filter_elements_set_created_by BEFORE INSERT ON public.filter_elements
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

CREATE INDEX filter_elements_org_idx ON public.filter_elements(organization_id);

-- 2. Compatibility with equipment
CREATE TABLE public.filter_element_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_element_id uuid NOT NULL REFERENCES public.filter_elements(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filter_element_id, equipment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_element_equipment TO authenticated;
GRANT ALL ON public.filter_element_equipment TO service_role;
ALTER TABLE public.filter_element_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access filter_element_equipment" ON public.filter_element_equipment
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.filter_elements fe WHERE fe.id = filter_element_id AND public.user_has_org_access(auth.uid(), fe.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.filter_elements fe WHERE fe.id = filter_element_id AND public.user_has_org_access(auth.uid(), fe.organization_id)));

CREATE INDEX filter_element_equipment_fe_idx ON public.filter_element_equipment(filter_element_id);
CREATE INDEX filter_element_equipment_eq_idx ON public.filter_element_equipment(equipment_id);

-- 3. Movements
CREATE TABLE public.filter_element_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  filter_element_id uuid NOT NULL REFERENCES public.filter_elements(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('IN','WRITE_OFF','ADJUST','RETURN')),
  quantity numeric NOT NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  responsible_user_id uuid,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_element_movements TO authenticated;
GRANT ALL ON public.filter_element_movements TO service_role;
ALTER TABLE public.filter_element_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view filter_element_movements" ON public.filter_element_movements
  FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can insert filter_element_movements" ON public.filter_element_movements
  FOR INSERT TO authenticated WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can update filter_element_movements" ON public.filter_element_movements
  FOR UPDATE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can delete filter_element_movements" ON public.filter_element_movements
  FOR DELETE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE TRIGGER filter_element_movements_set_created_by BEFORE INSERT ON public.filter_element_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

CREATE INDEX filter_element_movements_fe_idx ON public.filter_element_movements(filter_element_id);
CREATE INDEX filter_element_movements_org_idx ON public.filter_element_movements(organization_id);

-- 4. Stock RPC
CREATE OR REPLACE FUNCTION public.filter_element_stock(_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE type
      WHEN 'IN' THEN quantity
      WHEN 'RETURN' THEN quantity
      WHEN 'ADJUST' THEN quantity
      WHEN 'WRITE_OFF' THEN -quantity
      ELSE 0
    END
  ), 0)
  FROM public.filter_element_movements
  WHERE filter_element_id = _id;
$$;

-- 5. Deadstock
CREATE TABLE public.filter_element_deadstock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  filter_element_id uuid REFERENCES public.filter_elements(id) ON DELETE SET NULL,
  manufacturer text,
  name text NOT NULL,
  article text,
  cross_numbers text[] NOT NULL DEFAULT '{}',
  compatibility text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'шт',
  market_price numeric,
  actual_sale_price numeric,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','for_sale','sold','written_off')),
  buyer text,
  sold_at timestamptz,
  sale_comment text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_element_deadstock TO authenticated;
GRANT ALL ON public.filter_element_deadstock TO service_role;
ALTER TABLE public.filter_element_deadstock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view filter_element_deadstock" ON public.filter_element_deadstock
  FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can insert filter_element_deadstock" ON public.filter_element_deadstock
  FOR INSERT TO authenticated WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can update filter_element_deadstock" ON public.filter_element_deadstock
  FOR UPDATE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Org members can delete filter_element_deadstock" ON public.filter_element_deadstock
  FOR DELETE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE TRIGGER filter_element_deadstock_updated_at BEFORE UPDATE ON public.filter_element_deadstock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER filter_element_deadstock_set_created_by BEFORE INSERT ON public.filter_element_deadstock
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

CREATE OR REPLACE FUNCTION public.filter_element_deadstock_auto_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.quantity <= 0 THEN
    NEW.is_archived := true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER filter_element_deadstock_auto_archive_trg
  BEFORE INSERT OR UPDATE ON public.filter_element_deadstock
  FOR EACH ROW EXECUTE FUNCTION public.filter_element_deadstock_auto_archive();

CREATE INDEX filter_element_deadstock_org_idx ON public.filter_element_deadstock(organization_id);