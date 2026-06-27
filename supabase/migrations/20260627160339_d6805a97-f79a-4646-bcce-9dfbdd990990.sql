ALTER TABLE public.planner_tasks ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE public.planner_tasks ALTER COLUMN source SET DEFAULT 'manual';