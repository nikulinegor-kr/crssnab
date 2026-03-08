ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bik text;