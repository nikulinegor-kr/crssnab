-- 1. Task for Buravel when status becomes 'Доставлено в ТК'
CREATE OR REPLACE FUNCTION public.create_tk_pickup_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _assignee uuid;
BEGIN
  IF NEW.status = 'Доставлено в ТК' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    _assignee := public.find_user_by_full_name(NEW.organization_id, 'Буравель');
    IF _assignee IS NULL THEN
      RETURN NEW;
    END IF;
    -- Skip if an open auto-task already exists for this request
    IF EXISTS (
      SELECT 1 FROM public.planner_tasks t
      WHERE t.request_id = NEW.id
        AND t.source_rule = 'tk_pickup'
        AND t.archived_at IS NULL
        AND t.status <> 'done'
    ) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.planner_tasks (
      organization_id, request_id, object_id, title, description,
      status, priority, assignee_id, created_by, due_date, source, source_rule
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      NEW.object_id,
      'Организовать забор груза: ' || COALESCE(NEW.description, 'заявка ' || NEW.request_number::text),
      'Заявка в статусе «Доставлено в ТК»' || COALESCE(' (' || NEW.transport_company || ')', '') || '. Нужно организовать забор груза.',
      'todo',
      CASE
        WHEN NEW.priority ILIKE '%авар%' THEN 'urgent'
        WHEN NEW.priority ILIKE '%приор%' THEN 'high'
        ELSE 'medium'
      END,
      _assignee,
      _assignee,
      now(),
      'auto',
      'tk_pickup'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tk_pickup_task ON public.requests;
CREATE TRIGGER trg_tk_pickup_task
AFTER UPDATE OF status ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.create_tk_pickup_task();

-- 2. Task for Nikulin when delivery_date matches today
CREATE OR REPLACE FUNCTION public.create_arrival_check_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req RECORD;
  _assignee uuid;
  _created integer := 0;
BEGIN
  FOR req IN
    SELECT r.id, r.organization_id, r.object_id, r.description, r.request_number,
           r.priority, r.delivery_date
    FROM public.requests r
    WHERE r.delivery_date IS NOT NULL
      AND r.delivery_date::date = CURRENT_DATE
      AND r.archived = false
      AND r.status NOT IN ('Доставлено', 'Выполнено')
  LOOP
    _assignee := public.find_user_by_full_name(req.organization_id, 'Никулин');
    IF _assignee IS NULL THEN
      CONTINUE;
    END IF;
    -- One task per request per delivery date
    IF EXISTS (
      SELECT 1 FROM public.planner_tasks t
      WHERE t.request_id = req.id
        AND t.source_rule = 'arrival_check'
        AND t.due_date::date = req.delivery_date::date
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.planner_tasks (
      organization_id, request_id, object_id, title, description,
      status, priority, assignee_id, created_by, due_date, source, source_rule
    ) VALUES (
      req.organization_id,
      req.id,
      req.object_id,
      'Уточнить приход: ' || COALESCE(req.description, 'заявка ' || req.request_number::text),
      'Сегодня дата прихода по заявке. Нужно уточнить, прибыл ли груз.',
      'todo',
      CASE
        WHEN req.priority ILIKE '%авар%' THEN 'urgent'
        WHEN req.priority ILIKE '%приор%' THEN 'high'
        ELSE 'medium'
      END,
      _assignee,
      _assignee,
      req.delivery_date,
      'auto',
      'arrival_check'
    );
    _created := _created + 1;
  END LOOP;
  RETURN _created;
END;
$function$;

-- 3. Daily run at 01:00 UTC (08:00 Novosibirsk)
SELECT cron.schedule(
  'planner-arrival-check-tasks-daily',
  '0 1 * * *',
  $$SELECT public.create_arrival_check_tasks()$$
);