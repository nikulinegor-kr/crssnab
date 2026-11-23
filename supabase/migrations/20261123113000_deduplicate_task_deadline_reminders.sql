CREATE OR REPLACE FUNCTION public.planner_check_task_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- The planner stores the selected calendar date at UTC midnight.
  today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public.planner_check_task_deadlines', 0));

  WITH reminders AS (
    SELECT DISTINCT
      recipient.user_id,
      task.organization_id,
      '/planner?task=' || task.id::text AS link,
      task.title,
      to_char(task.due_date AT TIME ZONE 'UTC', 'DD.MM.YYYY') AS due_label,
      task.due_date < (today::timestamp AT TIME ZONE 'UTC') AS overdue
    FROM public.planner_tasks AS task
    CROSS JOIN LATERAL unnest(ARRAY[task.assignee_id, task.created_by]) AS recipient(user_id)
    WHERE task.due_date >= ((today - 1)::timestamp AT TIME ZONE 'UTC')
      AND task.due_date < ((today + 2)::timestamp AT TIME ZONE 'UTC')
      AND task.status NOT IN ('done', 'cancelled')
      AND task.archived_at IS NULL
      AND task.hidden_auto IS NOT TRUE
      AND recipient.user_id IS NOT NULL
  )
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
  SELECT
    reminder.user_id,
    reminder.organization_id,
    'task_deadline',
    CASE WHEN reminder.overdue THEN '⚠️ Срок задачи истёк' ELSE '⏰ Срок задачи скоро' END,
    '«' || reminder.title || '» · срок ' || reminder.due_label,
    reminder.link
  FROM reminders AS reminder
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications AS prior
    WHERE prior.user_id = reminder.user_id
      AND prior.organization_id = reminder.organization_id
      AND prior.link = reminder.link
      AND prior.message LIKE '% · срок ' || reminder.due_label
      AND CASE WHEN reminder.overdue THEN
        (prior.type = 'task_deadline' AND prior.title = '⚠️ Срок задачи истёк')
        OR (prior.type = 'planner_task' AND prior.title = '⚠️ Задача просрочена')
      ELSE
        (prior.type = 'task_deadline' AND prior.title = '⏰ Срок задачи скоро')
        OR (prior.type = 'planner_task' AND prior.title = '⏰ Приближается срок задачи')
      END
  );
END;
$$;
