
-- Warehouses
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org warehouses" ON public.warehouses FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can create org warehouses" ON public.warehouses FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can update org warehouses" ON public.warehouses FOR UPDATE USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Admins can delete org warehouses" ON public.warehouses FOR DELETE USING (user_is_org_admin(auth.uid(), organization_id));

-- Warehouse products
CREATE TABLE public.warehouse_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  article text,
  unit text DEFAULT 'шт',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouse_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org products" ON public.warehouse_products FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can create org products" ON public.warehouse_products FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can update org products" ON public.warehouse_products FOR UPDATE USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Admins can delete org products" ON public.warehouse_products FOR DELETE USING (user_is_org_admin(auth.uid(), organization_id));

-- Stock movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.warehouse_products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity integer NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org movements" ON public.stock_movements FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "Users can create org movements" ON public.stock_movements FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));

-- Trigger to validate movement type
CREATE OR REPLACE FUNCTION public.validate_stock_movement_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type NOT IN ('IN', 'OUT', 'RESERVE', 'UNRESERVE', 'MOVE_IN', 'MOVE_OUT') THEN
    RAISE EXCEPTION 'Invalid movement type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_stock_movement_type
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_stock_movement_type();
