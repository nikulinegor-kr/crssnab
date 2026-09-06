DROP TRIGGER IF EXISTS trg_sync_request_to_planner ON public.requests;
DROP FUNCTION IF EXISTS public.sync_request_to_planner() CASCADE;
DROP FUNCTION IF EXISTS public.planner_upsert_auto_task(uuid, uuid, text, text, text, uuid, timestamptz) CASCADE;

ALTER TABLE public.planner_tasks ADD COLUMN IF NOT EXISTS hidden_auto boolean NOT NULL DEFAULT false;

UPDATE public.planner_tasks
SET hidden_auto = true
WHERE source = 'auto_rule' AND hidden_auto = false;