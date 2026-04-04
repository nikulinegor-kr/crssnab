ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_percent integer DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Не оплачено';