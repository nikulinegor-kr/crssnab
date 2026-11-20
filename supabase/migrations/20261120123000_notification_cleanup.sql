-- Старые массовые напоминания не должны продолжать висеть у пользователей.
UPDATE public.notifications
SET is_read = true
WHERE type = 'planner_task'
  AND (title ILIKE '%просроч%' OR title ILIKE '%срок%')
  AND created_at < now() - interval '1 day';

CREATE OR REPLACE FUNCTION public.planner_check_task_deadlines()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.id, t.organization_id, t.title, t.assignee_id, t.created_by, t.due_date
    FROM public.planner_tasks t
    WHERE t.status NOT IN ('done', 'cancelled')
      AND t.due_date IS NOT NULL
      AND t.due_date::date <= (current_date + 1)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'task_deadline'
        AND n.link = '/planner?task=' || r.id::text
        AND n.created_at::date = current_date
    ) THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
      SELECT u, r.organization_id, 'task_deadline',
        CASE WHEN r.due_date::date < current_date THEN '⚠️ Срок задачи истёк' ELSE '⏰ Срок задачи скоро' END,
        '«' || r.title || '» · срок ' || to_char(r.due_date, 'DD.MM.YYYY'),
        '/planner?task=' || r.id::text
      FROM unnest(ARRAY[r.assignee_id, r.created_by]::uuid[]) AS u
      WHERE u IS NOT NULL;
    END IF;
  END LOOP;
END;
$$;
