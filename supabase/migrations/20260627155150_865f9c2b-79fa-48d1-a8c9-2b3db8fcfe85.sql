
-- 1. Extend planner_tasks
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_rule text,
  ADD COLUMN IF NOT EXISTS delegated_to uuid,
  ADD COLUMN IF NOT EXISTS last_auto_sync_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_tasks_auto_unique
  ON public.planner_tasks (organization_id, request_id, source_rule)
  WHERE source = 'auto_rule' AND request_id IS NOT NULL AND source_rule IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planner_tasks_due ON public.planner_tasks (organization_id, due_date) WHERE status <> 'done';

-- 2. Reminders table
CREATE TABLE IF NOT EXISTS public.planner_task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  offset_minutes integer NOT NULL,
  channel text NOT NULL DEFAULT 'app',
  fire_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_task_reminders TO authenticated;
GRANT ALL ON public.planner_task_reminders TO service_role;

ALTER TABLE public.planner_task_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage planner reminders" ON public.planner_task_reminders;
CREATE POLICY "Org members manage planner reminders" ON public.planner_task_reminders
  FOR ALL TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_planner_reminders_task ON public.planner_task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_planner_reminders_due ON public.planner_task_reminders(fire_at) WHERE sent_at IS NULL;

-- 3. Helper: find a user by full name
CREATE OR REPLACE FUNCTION public.find_user_by_full_name(_org_id uuid, _name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_organizations uo ON uo.user_id = p.id AND uo.organization_id = _org_id
  WHERE _name IS NOT NULL
    AND lower(btrim(p.full_name)) = lower(btrim(_name))
  LIMIT 1
$$;

-- 4. Upsert auto-task helper
CREATE OR REPLACE FUNCTION public.planner_upsert_auto_task(
  _org uuid,
  _request_id uuid,
  _rule text,
  _title text,
  _priority text,
  _assignee uuid,
  _due timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.planner_tasks (
    organization_id, request_id, source, source_rule, title, priority,
    assignee_id, due_date, status, last_auto_sync_at
  ) VALUES (
    _org, _request_id, 'auto_rule', _rule, _title, COALESCE(_priority,'medium'),
    _assignee, _due, 'todo', now()
  )
  ON CONFLICT (organization_id, request_id, source_rule)
    WHERE source = 'auto_rule' AND request_id IS NOT NULL AND source_rule IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    priority = EXCLUDED.priority,
    assignee_id = COALESCE(EXCLUDED.assignee_id, public.planner_tasks.assignee_id),
    due_date = COALESCE(EXCLUDED.due_date, public.planner_tasks.due_date),
    last_auto_sync_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 5. CRM → Planner sync trigger
CREATE OR REPLACE FUNCTION public.sync_request_to_planner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_assignee uuid;
  v_kazakova uuid;
  v_closed_statuses text[] := ARRAY['Доставлено','Отменено','Отклонено','Закрыто','Архив'];
  v_priority_lc text := lower(coalesce(NEW.priority,''));
  v_is_emergency boolean := v_priority_lc LIKE '%авар%';
BEGIN
  -- Resolve executor user
  IF NEW.executor IS NOT NULL THEN
    v_assignee := public.find_user_by_full_name(NEW.organization_id, NEW.executor);
  END IF;
  v_kazakova := public.find_user_by_full_name(NEW.organization_id, 'Казакова О.Б.');

  -- Closed request → close all related auto-tasks
  IF NEW.status = ANY(v_closed_statuses) OR COALESCE(NEW.archived,false) = true THEN
    UPDATE public.planner_tasks
       SET status = 'done', completed_at = COALESCE(completed_at, now()), updated_at = now()
     WHERE request_id = NEW.id AND source = 'auto_rule' AND status <> 'done';
  END IF;

  -- Executor changed → reassign all related auto-tasks (except those targeted to Казакова)
  IF TG_OP = 'UPDATE' AND OLD.executor IS DISTINCT FROM NEW.executor AND v_assignee IS NOT NULL THEN
    UPDATE public.planner_tasks
       SET assignee_id = v_assignee, updated_at = now()
     WHERE request_id = NEW.id
       AND source = 'auto_rule'
       AND source_rule NOT IN ('invoice_pending')
       AND status <> 'done';
  END IF;

  -- Rule: emergency request (open) → critical task for executor or unassigned
  IF v_is_emergency AND NEW.status <> ALL(v_closed_statuses) AND COALESCE(NEW.archived,false) = false THEN
    PERFORM public.planner_upsert_auto_task(
      NEW.organization_id, NEW.id, 'emergency_request',
      'Аварийная заявка: ' || COALESCE(NULLIF(NEW.description,''),'без названия'),
      'critical', v_assignee, COALESCE(NEW.delivery_date, now() + interval '1 day')
    );
  END IF;

  -- Rule: invoice present, not paid → task for accountant (Казакова)
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> ''
     AND COALESCE(lower(NEW.payment_status),'') NOT IN ('оплачено','оплачен','paid')
     AND NEW.status <> ALL(v_closed_statuses)
     AND COALESCE(NEW.archived,false) = false THEN
    PERFORM public.planner_upsert_auto_task(
      NEW.organization_id, NEW.id, 'invoice_pending',
      'Оплатить счёт №' || NEW.invoice_number || ' — ' || COALESCE(NULLIF(NEW.description,''),'заявка'),
      'high', v_kazakova, NEW.invoice_date
    );
  END IF;

  -- Rule: delivery due within 2 days → control task for executor
  IF NEW.delivery_date IS NOT NULL
     AND NEW.delivery_date <= now() + interval '2 days'
     AND NEW.status <> ALL(v_closed_statuses)
     AND COALESCE(NEW.archived,false) = false THEN
    PERFORM public.planner_upsert_auto_task(
      NEW.organization_id, NEW.id, 'delivery_due',
      'Контроль поставки: ' || COALESCE(NULLIF(NEW.description,''),'заявка'),
      CASE WHEN NEW.delivery_date < now() THEN 'critical' ELSE 'high' END,
      v_assignee, NEW.delivery_date
    );
  END IF;

  -- Rule: delivered → receipt task
  IF NEW.status = 'Доставлено' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Доставлено') THEN
    -- Re-open a receipt task even though closure block above closed others
    INSERT INTO public.planner_tasks (
      organization_id, request_id, source, source_rule, title, priority,
      assignee_id, due_date, status, last_auto_sync_at
    ) VALUES (
      NEW.organization_id, NEW.id, 'auto_rule', 'arrival_receipt',
      'Провести приёмку ТМЦ: ' || COALESCE(NULLIF(NEW.description,''),'заявка'),
      'high', v_assignee, now() + interval '1 day', 'todo', now()
    )
    ON CONFLICT (organization_id, request_id, source_rule)
      WHERE source = 'auto_rule' AND request_id IS NOT NULL AND source_rule IS NOT NULL
    DO UPDATE SET status = 'todo', completed_at = NULL,
                  assignee_id = COALESCE(EXCLUDED.assignee_id, public.planner_tasks.assignee_id),
                  due_date = EXCLUDED.due_date,
                  last_auto_sync_at = now(), updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_request_to_planner ON public.requests;
CREATE TRIGGER trg_sync_request_to_planner
  AFTER INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_request_to_planner();
