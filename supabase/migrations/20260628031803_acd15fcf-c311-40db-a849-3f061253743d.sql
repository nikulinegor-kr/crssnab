ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS current_object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_name text;

CREATE INDEX IF NOT EXISTS idx_equipment_current_object ON public.equipment(current_object_id);