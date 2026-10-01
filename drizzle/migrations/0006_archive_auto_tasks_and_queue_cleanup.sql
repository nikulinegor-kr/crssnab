-- 1. Mark legacy auto-generated planner tasks as archived so lists and counters can skip them.
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.planner_tasks
SET archived = true
WHERE source IN ('auto', 'auto_rule');

CREATE INDEX IF NOT EXISTS idx_planner_tasks_active
  ON public.planner_tasks (organization_id, status)
  WHERE archived = false;

-- 2. Housekeeping for the notification queue: drop delivered history older than 30 days.
CREATE OR REPLACE FUNCTION public.cleanup_notification_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notification_queue
  WHERE status IN ('delivered', 'skipped')
    AND created_at < now() - interval '30 days';

  -- Release notifications stuck in "sending" for more than 5 minutes.
  UPDATE public.notification_queue
  SET status = 'queued'
  WHERE status = 'sending'
    AND updated_at < now() - interval '5 minutes';
END;
$$;

SELECT cron.schedule(
  'cleanup-notification-queue',
  '30 3 * * *',
  $$SELECT public.cleanup_notification_queue();$$
);
