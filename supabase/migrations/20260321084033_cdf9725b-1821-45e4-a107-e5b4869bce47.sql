ALTER TABLE public.material_statement_items 
ADD COLUMN IF NOT EXISTS confidence integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT NULL;