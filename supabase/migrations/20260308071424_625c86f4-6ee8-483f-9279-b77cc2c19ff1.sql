ALTER TABLE public.requests 
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL;