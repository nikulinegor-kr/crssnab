-- Routing rule for new planner tasks (delivered to the "supply" groups)
INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, is_enabled)
SELECT o.id, 'planner.task_created', 'supply', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_routing_rules r
  WHERE r.organization_id = o.id AND r.event_type = 'planner.task_created'
);

-- Seed the rule for newly created organizations too
CREATE OR REPLACE FUNCTION public.seed_notification_routing(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, is_enabled)
  VALUES
    (_org_id, 'request.created', 'supply', true),
    (_org_id, 'request.incoming', 'incoming', true),
    (_org_id, 'request.status_changed', 'supply', true),
    (_org_id, 'request.executor_assigned', 'supply', true),
    (_org_id, 'request.comment_added', 'supply', true),
    (_org_id, 'invoice.created', 'invoice', true),
    (_org_id, 'invoice.pay_now', 'invoice', true),
    (_org_id, 'invoice.overdue', 'invoice', false),
    (_org_id, 'invoice.payment_changed', 'invoice', false),
    (_org_id, 'supply.arrived', 'supply', true),
    (_org_id, 'supply.attachment_added', 'supply', true),
    (_org_id, 'supply.cargo_moved', 'supply', true),
    (_org_id, 'planner.task_created', 'supply', true),
    (_org_id, 'alert.system_error', 'alert', true),
    (_org_id, 'alert.webhook_error', 'alert', true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Send every newly created task to the MAX / Telegram groups
CREATE OR REPLACE FUNCTION public.planner_task_log_and_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _targets uuid[];
  _assignee_name text;
  _group_text text;
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
$function$;