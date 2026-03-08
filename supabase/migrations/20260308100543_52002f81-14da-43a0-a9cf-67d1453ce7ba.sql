
-- Update the stock movement type validation trigger to accept INVENTORY
CREATE OR REPLACE FUNCTION public.validate_stock_movement_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type NOT IN ('IN', 'OUT', 'RESERVE', 'UNRESERVE', 'MOVE_IN', 'MOVE_OUT', 'IN_TRANSIT', 'INVENTORY') THEN
    RAISE EXCEPTION 'Invalid movement type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$function$;
