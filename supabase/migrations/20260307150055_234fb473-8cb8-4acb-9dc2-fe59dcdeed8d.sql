
ALTER TABLE public.request_objects
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid,
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS project_start_date date,
  ADD COLUMN IF NOT EXISTS project_end_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Активный',
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
