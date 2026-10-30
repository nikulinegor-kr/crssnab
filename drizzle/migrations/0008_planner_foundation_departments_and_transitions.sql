CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  head_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_select ON public.departments FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY departments_insert ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_role(auth.uid(), organization_id, 'owner') OR public.user_has_org_role(auth.uid(), organization_id, 'admin'));
CREATE POLICY departments_update ON public.departments FOR UPDATE TO authenticated
  USING (public.user_has_org_role(auth.uid(), organization_id, 'owner') OR public.user_has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.user_has_org_role(auth.uid(), organization_id, 'owner') OR public.user_has_org_role(auth.uid(), organization_id, 'admin'));
CREATE POLICY departments_delete ON public.departments FOR DELETE TO authenticated
  USING (public.user_has_org_role(auth.uid(), organization_id, 'owner') OR public.user_has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.user_organizations ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.planner_tasks
  ADD COLUMN reviewer_id uuid,
  ADD COLUMN co_assignee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN requires_acceptance boolean NOT NULL DEFAULT false,
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN blocked_reason text,
  ADD COLUMN blocked_until date,
  ADD COLUMN change_reason text;
CREATE INDEX planner_tasks_reviewer_idx ON public.planner_tasks (reviewer_id);
CREATE INDEX planner_tasks_org_department_idx ON public.planner_tasks (organization_id, department_id);
CREATE INDEX planner_tasks_co_assignees_idx ON public.planner_tasks USING gin (co_assignee_ids);
ALTER TABLE public.planner_tasks ADD CONSTRAINT planner_tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'accepted', 'in_progress', 'waiting', 'review', 'rework', 'done'));
ALTER TABLE public.planner_task_activity ADD COLUMN reason text;
CREATE OR REPLACE FUNCTION public.planner_task_transition_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NOT NULL THEN
    IF NEW.requires_acceptance AND NEW.reviewer_id IS NULL THEN
      RAISE EXCEPTION 'Для задачи с приёмкой нужен контролёр';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'waiting' AND nullif(btrim(NEW.blocked_reason), '') IS NULL THEN
        RAISE EXCEPTION 'Укажите причину ожидания';
      END IF;
      IF NEW.status = 'rework' AND nullif(btrim(NEW.change_reason), '') IS NULL THEN
        RAISE EXCEPTION 'Укажите, что доработать';
      END IF;
      IF NEW.status = 'done' AND NEW.requires_acceptance AND NOT (
        coalesce(_actor = NEW.reviewer_id, false)
        OR coalesce(_actor = NEW.created_by, false)
        OR public.user_has_org_role(_actor, NEW.organization_id, 'owner')
        OR public.user_has_org_role(_actor, NEW.organization_id, 'admin')
      ) THEN
        RAISE EXCEPTION 'Задачу с приёмкой закрывает контролёр — передайте её на проверку';
      END IF;
    END IF;
  END IF;
  IF OLD.status = 'waiting' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.blocked_reason := NULL;
    NEW.blocked_until := NULL;
  END IF;
  IF NEW.status = 'accepted' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := now();
  END IF;
  PERFORM set_config('crss.change_reason', coalesce(NEW.change_reason, ''), true);
  NEW.change_reason := NULL;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.planner_task_transition_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER planner_task_transition_guard BEFORE UPDATE ON public.planner_tasks
  FOR EACH ROW EXECUTE FUNCTION public.planner_task_transition_guard();
CREATE OR REPLACE FUNCTION public.planner_status_label(_s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
  SELECT CASE _s
    WHEN 'backlog' THEN 'Новая'
    WHEN 'todo' THEN 'Новая'
    WHEN 'accepted' THEN 'Принята'
    WHEN 'in_progress' THEN 'В работе'
    WHEN 'waiting' THEN 'Ожидает'
    WHEN 'review' THEN 'На проверке'
    WHEN 'rework' THEN 'На доработке'
    WHEN 'done' THEN 'Завершена'
    ELSE coalesce(_s, '—') END
$function$;
CREATE OR REPLACE FUNCTION public.planner_task_log_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _targets uuid[];
  _assignee_name text;
  _group_text text;
  _reason text := CASE WHEN TG_OP = 'UPDATE' THEN nullif(current_setting('crss.change_reason', true), '') ELSE NULL END;
BEGIN
  SELECT full_name INTO _actor_name FROM public.profiles WHERE id = _actor;
  _actor_name := coalesce(_actor_name, 'Сотрудник');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'created', _actor_name || ' создал(а) задачу', _reason);

    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, new_value, description, reason)
      VALUES (NEW.id, NEW.organization_id, _actor, 'assigned', 'assignee_id', NEW.assignee_id::text, _actor_name || ' назначил(а) ответственного', _reason);
      PERFORM public.planner_notify_users(
        NEW.organization_id, NEW.id, '🔔 Вам назначена задача',
        NEW.title || coalesce(' · срок ' || to_char(NEW.due_date, 'DD.MM.YYYY'), ''),
        ARRAY[NEW.assignee_id]
      );
    END IF;

    -- Group notification (MAX / Telegram)
    SELECT full_name INTO _assignee_name FROM public.profiles WHERE id = NEW.assignee_id;
    _group_text :=
      '📋 Новая задача' || E'\n\n' ||
      NEW.title || E'\n' ||
      '👤 Ответственный — ' || coalesce(nullif(_assignee_name, ''), 'не назначен') || E'\n' ||
      '📅 Срок — ' || coalesce(to_char(NEW.due_date, 'DD.MM.YYYY'), 'без срока') || E'\n' ||
      '⭐ Приоритет — ' || public.planner_priority_label(NEW.priority) ||
      coalesce(E'\n\n📝 ' || nullif(NEW.description, ''), '');

    PERFORM public.enqueue_notification(
      NEW.organization_id,
      'planner.task_created',
      'planner_task',
      NEW.id::text,
      _group_text,
      jsonb_build_object('task_id', NEW.id, 'request_id', NEW.request_id, 'source', NEW.source),
      'created'
    );

    RETURN NEW;
  END IF;

  _targets := ARRAY[NEW.assignee_id, NEW.created_by, OLD.assignee_id];

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'status_changed', 'status', OLD.status, NEW.status,
      _actor_name || ': ' || public.planner_status_label(OLD.status) || ' → ' || public.planner_status_label(NEW.status), _reason);
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Статус задачи изменён',
      '«' || NEW.title || '» ' || _actor_name || ': ' || public.planner_status_label(OLD.status) || ' → ' || public.planner_status_label(NEW.status),
      _targets);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'priority_changed', 'priority', OLD.priority, NEW.priority,
      _actor_name || ' изменил(а) приоритет: ' || public.planner_priority_label(OLD.priority) || ' → ' || public.planner_priority_label(NEW.priority), _reason);
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Приоритет задачи изменён',
      '«' || NEW.title || '» → ' || public.planner_priority_label(NEW.priority), _targets);
  END IF;

  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'due_changed', 'due_date', OLD.due_date::text, NEW.due_date::text,
      _actor_name || ' изменил(а) срок', _reason);
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Срок задачи изменён',
      '«' || NEW.title || '» → ' || coalesce(to_char(NEW.due_date, 'DD.MM.YYYY'), 'без срока'), _targets);
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'reassigned', 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text,
      _actor_name || ' переназначил(а) задачу', _reason);
    PERFORM public.planner_notify_users(NEW.organization_id, NEW.id, '🔔 Вам назначена задача', NEW.title, ARRAY[NEW.assignee_id]);
  END IF;

  IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'reassigned', 'reviewer_id', OLD.reviewer_id::text, NEW.reviewer_id::text,
      _actor_name || ' изменил(а) контролёра', _reason);
  END IF;

  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'reassigned', 'department_id', OLD.department_id::text, NEW.department_id::text,
      _actor_name || ' изменил(а) подразделение', _reason);
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description, reason)
    VALUES (NEW.id, NEW.organization_id, _actor, 'renamed', 'title', OLD.title, NEW.title, _actor_name || ' изменил(а) название', _reason);
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.planner_task_log_and_notify() FROM PUBLIC, anon, authenticated;