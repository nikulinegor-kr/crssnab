
-- Add ERP fields to requests table
ALTER TABLE public.requests 
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'шт',
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS planned_delivery_date date,
  ADD COLUMN IF NOT EXISTS reserve_on_warehouse boolean DEFAULT false;

-- Update trigger to use quantity and handle reservations
CREATE OR REPLACE FUNCTION public.handle_request_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if product_id and warehouse_id are set
  IF NEW.product_id IS NULL OR NEW.warehouse_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Handle reservation changes
  IF TG_OP = 'UPDATE' AND OLD.reserve_on_warehouse IS DISTINCT FROM NEW.reserve_on_warehouse THEN
    IF NEW.reserve_on_warehouse = true THEN
      INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
      VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'RESERVE', COALESCE(NEW.quantity, 1), NEW.id, 'Резерв по заявке #' || NEW.request_number, auth.uid());
    ELSE
      INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
      VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'UNRESERVE', COALESCE(NEW.quantity, 1), NEW.id, 'Снятие резерва по заявке #' || NEW.request_number, auth.uid());
    END IF;
  END IF;

  -- Only on status change
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Status changed to "В пути" -> create IN_TRANSIT movement
  IF NEW.status = 'В пути' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'В пути') THEN
    INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
    VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'IN_TRANSIT', COALESCE(NEW.quantity, 1), NEW.id, 'Товар в пути по заявке #' || NEW.request_number, NEW.created_by);
  END IF;

  -- Status changed to "Доставлено" -> create IN movement
  IF NEW.status = 'Доставлено' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Доставлено') THEN
    INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, request_id, comment, created_by)
    VALUES (NEW.organization_id, NEW.product_id, NEW.warehouse_id, 'IN', COALESCE(NEW.quantity, 1), NEW.id, 'Поступление по заявке #' || NEW.request_number, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$function$;
