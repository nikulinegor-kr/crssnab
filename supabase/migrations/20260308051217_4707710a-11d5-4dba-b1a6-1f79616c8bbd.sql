ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS invoice_date date,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Не выставлен';