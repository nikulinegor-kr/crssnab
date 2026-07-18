
ALTER TABLE public.filter_element_movements
  DROP CONSTRAINT IF EXISTS filter_element_movements_type_check;

ALTER TABLE public.filter_element_movements
  ADD CONSTRAINT filter_element_movements_type_check
  CHECK (type = ANY (ARRAY['IN','WRITE_OFF','ADJUST','RETURN','MOVE']));

ALTER TABLE public.filter_element_movements
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS from_location text,
  ADD COLUMN IF NOT EXISTS to_location text,
  ADD COLUMN IF NOT EXISTS receipt_date timestamptz;
