
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS plate_number text,
  ADD COLUMN IF NOT EXISTS comment text;

CREATE UNIQUE INDEX IF NOT EXISTS equipment_vin_unique ON public.equipment (vin) WHERE vin IS NOT NULL AND vin != '';
