
ALTER TABLE public.warehouse_products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 0;
