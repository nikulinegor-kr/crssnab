
-- Add object_id to warehouses table
ALTER TABLE public.warehouses 
  ADD COLUMN IF NOT EXISTS object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;
