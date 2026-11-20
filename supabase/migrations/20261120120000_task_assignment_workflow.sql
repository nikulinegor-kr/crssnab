ALTER TABLE public.planner_tasks ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.planner_task_log_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid(); _actor_name text; _targets uuid[];
BEGIN
  SELECT full_name INTO _actor_name FROM public.profiles WHERE id = _actor;
  _actor_name := coalesce(_actor_name, 'Сотрудник');
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, description)
    VALUES (NEW.id, NEW.organization_id, _actor, 'created', _actor_name || ' создал(а) задачу');
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, new_value, description)
      VALUES (NEW.id, NEW.organization_id, _actor, 'assigned', 'assignee_id', NEW.assignee_id::text, _actor_name || ' назначил(а) ответственного');
      IF NEW.assignee_id IS DISTINCT FROM _actor THEN
        INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
        SELECT NEW.assignee_id, NEW.organization_id, 'task_assigned', '🔔 Вам назначена задача', NEW.title || coalesce(' · срок ' || to_char(NEW.due_date, 'DD.MM.YYYY'), ''), '/planner?task=' || NEW.id::text
        WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=NEW.assignee_id AND n.organization_id=NEW.organization_id AND n.type='task_assigned' AND n.link='/planner?task='||NEW.id::text AND n.is_read=false);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  _targets := ARRAY[NEW.assignee_id, NEW.created_by, OLD.assignee_id];
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.planner_task_activity(task_id, organization_id, user_id, action, field_name, old_value, new_value, description) VALUES (NEW.id,NEW.organization_id,_actor,'status_changed','status',OLD.status,NEW.status,_actor_name||': '||public.planner_status_label(OLD.status)||' → '||public.planner_status_label(NEW.status));
    PERFORM public.planner_notify_users(NEW.organization_id,NEW.id,'🔔 Статус задачи изменён','«'||NEW.title||'» '||_actor_name||': '||public.planner_status_label(OLD.status)||' → '||public.planner_status_label(NEW.status),_targets);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.planner_task_activity(task_id,organization_id,user_id,action,field_name,old_value,new_value,description) VALUES (NEW.id,NEW.organization_id,_actor,'priority_changed','priority',OLD.priority,NEW.priority,_actor_name||' изменил(а) приоритет: '||public.planner_priority_label(OLD.priority)||' → '||public.planner_priority_label(NEW.priority));
    PERFORM public.planner_notify_users(NEW.organization_id,NEW.id,'🔔 Приоритет задачи изменён','«'||NEW.title||'» → '||public.planner_priority_label(NEW.priority),_targets);
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO public.planner_task_activity(task_id,organization_id,user_id,action,field_name,old_value,new_value,description) VALUES (NEW.id,NEW.organization_id,_actor,'due_changed','due_date',OLD.due_date::text,NEW.due_date::text,_actor_name||' изменил(а) срок');
    PERFORM public.planner_notify_users(NEW.organization_id,NEW.id,'🔔 Срок задачи изменён','«'||NEW.title||'» → '||coalesce(to_char(NEW.due_date,'DD.MM.YYYY'),'без срока'),_targets);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.planner_task_activity(task_id,organization_id,user_id,action,field_name,old_value,new_value,description) VALUES (NEW.id,NEW.organization_id,_actor,'reassigned','assignee_id',OLD.assignee_id::text,NEW.assignee_id::text,_actor_name||' переназначил(а) задачу');
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM _actor THEN
      INSERT INTO public.notifications (user_id,organization_id,type,title,message,link)
      SELECT NEW.assignee_id,NEW.organization_id,'task_assigned','🔔 Вам назначена задача',NEW.title,'/planner?task='||NEW.id::text
      WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=NEW.assignee_id AND n.organization_id=NEW.organization_id AND n.type='task_assigned' AND n.link='/planner?task='||NEW.id::text AND n.is_read=false);
    END IF;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN INSERT INTO public.planner_task_activity(task_id,organization_id,user_id,action,field_name,old_value,new_value,description) VALUES (NEW.id,NEW.organization_id,_actor,'renamed','title',OLD.title,NEW.title,_actor_name||' изменил(а) название'); END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.planner_comment_log_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.planner_tasks; _actor_name text;
BEGIN
  SELECT * INTO _t FROM public.planner_tasks WHERE id=NEW.task_id;
  SELECT coalesce(full_name,'Сотрудник') INTO _actor_name FROM public.profiles WHERE id=NEW.user_id;
  INSERT INTO public.planner_task_activity(task_id,organization_id,user_id,action,description) VALUES (NEW.task_id,NEW.organization_id,NEW.user_id,'commented',coalesce(_actor_name,'Сотрудник')||' добавил(а) комментарий');
  IF _t.id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id,organization_id,type,title,message,link)
    SELECT target_user, _t.organization_id, 'task_reply', 'Новый ответ по задаче', 'По задаче «'||_t.title||'» появился новый ответ: '||left(NEW.content,140), '/planner?task='||_t.id::text
    FROM unnest(ARRAY[_t.created_by,_t.assignee_id]::uuid[]) target_user
    WHERE target_user IS NOT NULL AND target_user IS DISTINCT FROM NEW.user_id
      AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=target_user AND n.organization_id=_t.organization_id AND n.type='task_reply' AND n.link='/planner?task='||_t.id::text AND n.is_read=false);
  END IF; RETURN NEW;
END; $$;
