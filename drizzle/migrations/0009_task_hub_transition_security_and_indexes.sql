CREATE OR REPLACE FUNCTION public.planner_task_transition_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _actor uuid := auth.uid();
  _can_configure boolean := false;
  _can_review boolean := false;
BEGIN
  IF _actor IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      _can_configure := coalesce(_actor = OLD.created_by, false)
        OR public.user_has_org_role(_actor, OLD.organization_id, 'owner')
        OR public.user_has_org_role(_actor, OLD.organization_id, 'admin');
      _can_review := _can_configure OR coalesce(_actor = OLD.reviewer_id, false);
      IF (NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id OR NEW.requires_acceptance IS DISTINCT FROM OLD.requires_acceptance) AND NOT _can_configure THEN
        RAISE EXCEPTION 'Контролёра и приёмку меняет постановщик';
      END IF;
    END IF;
    IF NEW.requires_acceptance THEN
      IF NEW.reviewer_id IS NULL THEN
        RAISE EXCEPTION 'Для задачи с приёмкой нужен контролёр';
      END IF;
      IF NEW.reviewer_id = NEW.assignee_id THEN
        RAISE EXCEPTION 'Контролёр не может быть исполнителем';
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'waiting' AND nullif(btrim(NEW.blocked_reason), '') IS NULL THEN
        RAISE EXCEPTION 'Укажите причину ожидания';
      END IF;
      IF NEW.status = 'rework' THEN
        IF NOT _can_review THEN
          RAISE EXCEPTION 'На доработку отправляет контролёр или постановщик';
        END IF;
        IF nullif(btrim(NEW.change_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Укажите, что доработать';
        END IF;
      END IF;
      IF NEW.status = 'done' AND NEW.requires_acceptance AND NOT _can_review THEN
        RAISE EXCEPTION 'Задачу с приёмкой закрывает контролёр — передайте её на проверку';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'waiting' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.blocked_reason := NULL;
      NEW.blocked_until := NULL;
    END IF;
    IF NEW.status = 'accepted' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.accepted_at IS NULL THEN
      NEW.accepted_at := now();
    END IF;
  END IF;
  PERFORM set_config('crss.change_reason', coalesce(NEW.change_reason, ''), true);
  NEW.change_reason := NULL;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.planner_task_transition_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER planner_task_transition_guard_insert BEFORE INSERT ON public.planner_tasks
  FOR EACH ROW EXECUTE FUNCTION public.planner_task_transition_guard();
CREATE INDEX planner_tasks_org_assignee_status_idx ON public.planner_tasks (organization_id, assignee_id, status);
CREATE INDEX planner_tasks_org_creator_status_idx ON public.planner_tasks (organization_id, created_by, status);
CREATE INDEX planner_tasks_org_reviewer_status_idx ON public.planner_tasks (organization_id, reviewer_id, status);
COMMENT ON TABLE public.tasks IS 'DEPRECATED: replaced by public.planner_tasks; retained for rollback';
-- Extend existing row visibility to the new task participants without widening organization or private-task boundaries.
ALTER POLICY "Planner read own or managed tasks" ON public.planner_tasks USING (
  public.user_has_org_access(auth.uid(), organization_id)
  AND (public.user_can_see_all_tasks(auth.uid(), organization_id) OR created_by = auth.uid() OR assignee_id = auth.uid() OR reviewer_id = auth.uid() OR auth.uid() = ANY(co_assignee_ids))
  AND (is_private = false OR created_by = auth.uid() OR assignee_id = auth.uid() OR reviewer_id = auth.uid() OR auth.uid() = ANY(co_assignee_ids))
);
ALTER POLICY "Planner update own or managed tasks" ON public.planner_tasks USING (
  public.user_has_org_access(auth.uid(), organization_id)
  AND (public.user_can_see_all_tasks(auth.uid(), organization_id) OR created_by = auth.uid() OR assignee_id = auth.uid() OR reviewer_id = auth.uid() OR auth.uid() = ANY(co_assignee_ids))
);