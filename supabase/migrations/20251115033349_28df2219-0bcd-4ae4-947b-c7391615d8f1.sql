-- Update status constraint for requests table
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
ADD CONSTRAINT requests_status_check 
CHECK (status IN ('Новая заявка', 'На согласовании', 'КП', 'Счёт', 'В работе', 'В пути', 'Доставлено в ТК', 'Доставлено', 'Выполнено'));