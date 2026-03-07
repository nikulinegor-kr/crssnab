
CREATE OR REPLACE FUNCTION public.validate_stock_movement_type()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type NOT IN ('IN', 'OUT', 'RESERVE', 'UNRESERVE', 'MOVE_IN', 'MOVE_OUT') THEN
    RAISE EXCEPTION 'Invalid movement type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;
