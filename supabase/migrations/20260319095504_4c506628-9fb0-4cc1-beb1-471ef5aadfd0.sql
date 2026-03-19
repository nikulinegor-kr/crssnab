ALTER TABLE public.material_statement_items 
ADD COLUMN item_type text NOT NULL DEFAULT 'material';

COMMENT ON COLUMN public.material_statement_items.item_type IS 'Type of item: material or work';