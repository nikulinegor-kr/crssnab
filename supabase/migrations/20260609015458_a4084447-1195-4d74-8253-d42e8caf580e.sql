ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS invoice_number_2 text,
  ADD COLUMN IF NOT EXISTS amount_2 numeric(12,2),
  ADD COLUMN IF NOT EXISTS invoice_number_3 text,
  ADD COLUMN IF NOT EXISTS amount_3 numeric(12,2);