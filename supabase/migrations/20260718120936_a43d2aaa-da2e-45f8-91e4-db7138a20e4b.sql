
-- 1. Extend spare_parts
ALTER TABLE public.spare_parts
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS cross_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS rack text,
  ADD COLUMN IF NOT EXISTS shelf text,
  ADD COLUMN IF NOT EXISTS cell text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS avg_cost numeric,
  ADD COLUMN IF NOT EXISTS last_receipt_at timestamptz,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Ensure RLS + policies on spare_parts (idempotent)
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='spare_parts' AND policyname='Org members manage spare_parts') THEN
    CREATE POLICY "Org members manage spare_parts" ON public.spare_parts
      FOR ALL TO authenticated
      USING (public.user_has_org_access(auth.uid(), organization_id))
      WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spare_parts TO authenticated;
GRANT ALL ON public.spare_parts TO service_role;

-- 2. spare_part_equipment (compatibility N:N)
CREATE TABLE IF NOT EXISTS public.spare_part_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_part_id uuid NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spare_part_id, equipment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spare_part_equipment TO authenticated;
GRANT ALL ON public.spare_part_equipment TO service_role;
ALTER TABLE public.spare_part_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage spare_part_equipment" ON public.spare_part_equipment
  FOR ALL TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_spe_part ON public.spare_part_equipment(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_spe_equipment ON public.spare_part_equipment(equipment_id);

-- 3. spare_part_movements
CREATE TABLE IF NOT EXISTS public.spare_part_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  spare_part_id uuid NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('IN','WRITE_OFF','MOVE','SALE','RETURN','ADJUST')),
  quantity numeric NOT NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  comment text,
  unit_price numeric,
  buyer text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spare_part_movements TO authenticated;
GRANT ALL ON public.spare_part_movements TO service_role;
ALTER TABLE public.spare_part_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage spare_part_movements" ON public.spare_part_movements
  FOR ALL TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_spm_part ON public.spare_part_movements(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_spm_org_created ON public.spare_part_movements(organization_id, created_at DESC);

-- Auto-update last_receipt_at on IN
CREATE OR REPLACE FUNCTION public.spare_part_movement_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'IN' THEN
    UPDATE public.spare_parts
       SET last_receipt_at = NEW.created_at,
           updated_at = now()
     WHERE id = NEW.spare_part_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_spare_part_movement_ai ON public.spare_part_movements;
CREATE TRIGGER trg_spare_part_movement_ai
AFTER INSERT ON public.spare_part_movements
FOR EACH ROW EXECUTE FUNCTION public.spare_part_movement_after_insert();

-- 4. Stock RPC
CREATE OR REPLACE FUNCTION public.spare_part_stock(_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE type
      WHEN 'IN' THEN quantity
      WHEN 'RETURN' THEN quantity
      WHEN 'ADJUST' THEN quantity
      WHEN 'WRITE_OFF' THEN -quantity
      WHEN 'SALE' THEN -quantity
      WHEN 'MOVE' THEN 0
      ELSE 0
    END
  ), 0)
  FROM public.spare_part_movements
  WHERE spare_part_id = _id;
$$;

-- 5. spare_part_deadstock
CREATE TABLE IF NOT EXISTS public.spare_part_deadstock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  article text,
  cross_numbers text[] NOT NULL DEFAULT '{}',
  manufacturer text,
  quantity numeric NOT NULL DEFAULT 0,
  reason text,
  market_price numeric,
  min_sale_price numeric,
  sale_price numeric,
  sold_at date,
  buyer text,
  comment text,
  photos text[] NOT NULL DEFAULT '{}',
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spare_part_deadstock TO authenticated;
GRANT ALL ON public.spare_part_deadstock TO service_role;
ALTER TABLE public.spare_part_deadstock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage spare_part_deadstock" ON public.spare_part_deadstock
  FOR ALL TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));
CREATE INDEX IF NOT EXISTS idx_spd_org ON public.spare_part_deadstock(organization_id);

DROP TRIGGER IF EXISTS trg_spd_updated_at ON public.spare_part_deadstock;
CREATE TRIGGER trg_spd_updated_at
BEFORE UPDATE ON public.spare_part_deadstock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-archive when quantity hits 0
CREATE OR REPLACE FUNCTION public.spare_part_deadstock_auto_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.quantity <= 0 THEN
    NEW.is_archived := true;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_spd_auto_archive ON public.spare_part_deadstock;
CREATE TRIGGER trg_spd_auto_archive
BEFORE INSERT OR UPDATE ON public.spare_part_deadstock
FOR EACH ROW EXECUTE FUNCTION public.spare_part_deadstock_auto_archive();
