
-- Add product_id and warehouse_id to requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.warehouse_products(id) ON DELETE SET NULL;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- Update movement type validator to include IN_TRANSIT
CREATE OR REPLACE FUNCTION public.validate_stock_movement_type()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('IN', 'OUT', 'RESERVE', 'UNRESERVE', 'MOVE_IN', 'MOVE_OUT', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Invalid movement type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for auto stock movements on request status change
CREATE OR REPLACE FUNCTION public.handle_request_stock_movement()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process if product_id and warehouse_id are set
  IF NEW.product_id IS NULL OR NEW.warehouse_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only on status change
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Status changed to "В пути" -> create IN_TRANSIT movement
  IF NEW.status = 'В пути' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'В пути') THEN
    INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
    VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'IN_TRANSIT', 1, NEW.id, 'Товар в пути по заявке #' || NEW.request_number, NEW.created_by);
  END IF;

  -- Status changed to "Доставлено" -> create IN movement
  IF NEW.status = 'Доставлено' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Доставлено') THEN
    INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
    VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'IN', 1, NEW.id, 'Поступление по заявке #' || NEW.request_number, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_request_stock_movement
  AFTER INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_stock_movement();
