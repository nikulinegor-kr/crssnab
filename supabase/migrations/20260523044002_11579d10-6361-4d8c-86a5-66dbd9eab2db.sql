ALTER TABLE public.supplier_list_items
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS extraction_failed boolean NOT NULL DEFAULT false;