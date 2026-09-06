
-- Helper: readable labels
CREATE OR REPLACE FUNCTION public.planner_status_label(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _s
    WHEN 'backlog' THEN 'Новые'
    WHEN 'todo' THEN 'Новые'
    WHEN 'in_progress' THEN 'В работе'
    WHEN 'review' THEN 'На проверке'
    WHEN 'done' THEN 'Выполнено'
    ELSE coalesce(_s,'—') END
$$;

CREATE OR REPLACE FUNCTION public.planner_priority_label(_p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _p
    WHEN 'critical' THEN 'Аварийно'
    WHEN 'urgent' THEN 'Аварийно'
    WHEN 'high' THEN 'Приоритетно'
    WHEN 'medium' THEN 'Планово'
    WHEN 'low' THEN 'Планово'
    ELSE coalesce(_p,'—') END
$$;

CREATE OR REPLACE FUNCTION public.planner_notify_users(
  _org uuid, _task_id uuid, _title text, _message text, _targets uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _u uuid;
  _actor uuid := auth.uid();
BEGIN
  FOREACH _u IN ARRAY coalesce(_targets, ARRAY[]::uuid[]) LOOP
    IF _u IS NOT NULL AND _u IS DISTINCT FROM _actor THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
      VALUES (_u, _org, 'planner_task', _title, _message, '/planner?task=' || _task_id::text)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.planner_task_log_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _targets uuid[];
BEGIN
  SELECT full_name INTO _actor_name FROM public.profiles WHERE id = _actor;
  _actor_name := coalesce(_actor_name, 'Сотрудник');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'created', _actor_name || ' создал(а) задачу');

    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, new_value, description)
      VALUES (NEW.id, NEW.organization_id, _actor, 'assigned', 'assignee_id', NEW.assignee_id::text, _actor_name || ' назначил(а) ответственного');
      PERFORM public.planner_notify_users(
        NEW.organization_id, NEW.id, '🔔 Вам назначена задача',
        NEW.title || coalesce(' · срок ' || to_char(NEW.due_date, 'DD.MM.YYYY'), ''),
        ARRAY[NEW.assignee_id]
      );
    END IF;
    RETURN NEW;
  END IF;

  _targets := ARRAY[NEW.assignee_id, NEW.created_by, OLD.assignee_id];

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'status_changed', 'status', OLD.status, NEW.status,
      _actor_name || ': ' || public.planner_status_label(OLD.status) || ' → ' || public.planner_status_label(NEW.status));
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Статус задачи изменён',
      '«' || NEW.title || '» ' || _actor_name || ': ' || public.planner_status_label(OLD.status) || ' → ' || public.planner_status_label(NEW.status),
      _targets);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'priority_changed', 'priority', OLD.priority, NEW.priority,
      _actor_name || ' изменил(а) приоритет: ' || public.planner_priority_label(OLD.priority) || ' → ' || public.planner_priority_label(NEW.priority));
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Приоритет задачи изменён',
      '«' || NEW.title || '» → ' || public.planner_priority_label(NEW.priority), _targets);
  END IF;

  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'due_changed', 'due_date', OLD.due_date::text, NEW.due_date::text,
      _actor_name || ' изменил(а) срок');
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Срок задачи изменён',
      '«' || NEW.title || '» → ' || coalesce(to_char(NEW.due_date, 'DD.MM.YYYY'), 'без срока'), _targets);
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'reassigned', 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text,
      _actor_name || ' переназначил(а) задачу');
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Вам назначена задача', NEW.title, ARRAY[NEW.assignee_id]);
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'renamed', 'title', OLD.title, NEW.title, _actor_name || ' изменил(а) название');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planner_tasks_activity ON public.planner_tasks;
CREATE TRIGGER planner_tasks_activity
AFTER INSERT OR UPDATE ON public.planner_tasks
FOR EACH ROW EXECUTE FUNCTION public.planner_task_log_and_notify();

CREATE OR REPLACE FUNCTION public.planner_comment_log_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _t public.planner_tasks;
  _actor_name text;
BEGIN
  SELECT * INTO _t FROM public.planner_tasks WHERE id = NEW.task_id;
  SELECT coalesce(full_name, 'Сотрудник') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, description)
  VALUES (NEW.task_id, NEW.organization_id, NEW.user_id, 'commented', coalesce(_actor_name,'Сотрудник') || ' добавил(а) комментарий');

  IF _t.id IS NOT NULL THEN
    PERFORM public.planner_notify_users(_t.organization_id, _t.id, '🔔 Новый комментарий к задаче',
      '«' || _t.title || '»: ' || left(NEW.content, 140), ARRAY[_t.assignee_id, _t.created_by]);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planner_comments_activity ON public.planner_task_comments;
CREATE TRIGGER planner_comments_activity
AFTER INSERT ON public.planner_task_comments
FOR EACH ROW EXECUTE FUNCTION public.planner_comment_log_and_notify();

-- Deadline / overdue reminders (idempotent per day)
CREATE OR REPLACE FUNCTION public.planner_check_task_deadlines()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.id, t.organization_id, t.title, t.assignee_id, t.created_by, t.due_date
    FROM public.planner_tasks t
    WHERE t.status <> 'done' AND t.due_date IS NOT NULL
      AND t.due_date::date <= (now() + interval '1 day')::date
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'planner_task'
        AND n.link = '/planner?task=' || r.id::text
        AND n.created_at > now() - interval '20 hours'
        AND (n.title LIKE '%срок%' OR n.title LIKE '%росроч%')
    ) THEN
      INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
      SELECT u, r.organization_id, 'planner_task',
        CASE WHEN r.due_date::date < current_date THEN '⚠️ Задача просрочена' ELSE '⏰ Приближается срок задачи' END,
        '«' || r.title || '» · срок ' || to_char(r.due_date, 'DD.MM.YYYY'),
        '/planner?task=' || r.id::text
      FROM unnest(ARRAY[r.assignee_id, r.created_by]) AS u
      WHERE u IS NOT NULL;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('planner-task-deadlines') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'planner-task-deadlines');
    PERFORM cron.schedule('planner-task-deadlines', '0 4 * * *', 'SELECT public.planner_check_task_deadlines()');
  END IF;
END $$;
