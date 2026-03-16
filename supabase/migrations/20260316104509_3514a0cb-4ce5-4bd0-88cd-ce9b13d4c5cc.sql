
-- Add sort_order to material_folders
ALTER TABLE public.material_folders ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Add price, total_price, supplier to material_statement_items
ALTER TABLE public.material_statement_items ADD COLUMN IF NOT EXISTS price numeric DEFAULT NULL;
ALTER TABLE public.material_statement_items ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT NULL;
ALTER TABLE public.material_statement_items ADD COLUMN IF NOT EXISTS supplier text DEFAULT NULL;
