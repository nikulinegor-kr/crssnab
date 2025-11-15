-- Add priority column to requests table
ALTER TABLE public.requests 
ADD COLUMN priority text DEFAULT 'Планово'::text;

-- Add check constraint for priority values
ALTER TABLE public.requests
ADD CONSTRAINT requests_priority_check 
CHECK (priority IN ('Аварийно', 'Планово', 'Приоритетно'));