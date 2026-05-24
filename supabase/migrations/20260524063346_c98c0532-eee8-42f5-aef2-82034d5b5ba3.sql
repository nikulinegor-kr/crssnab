-- New template for the message that replaces the original "incoming" one
CREATE OR REPLACE FUNCTION public.build_assigned_message_v2(r requests)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts text[] := ARRAY[]::text[];
  obj_name text;
BEGIN
  SELECT name INTO obj_name FROM public.request_objects WHERE id = r.object_id;

  parts := parts || '✅ Исполнитель назначен'::text;
  parts := parts || ''::text;
  parts := parts || ('🧾 Заявка:' || E'\n' || COALESCE(NULLIF(r.description,''), 'Без названия'))::text;
  parts := parts || ''::text;
  parts := parts || ('⭐ Приоритет:' || E'\n' || COALESCE(NULLIF(r.priority::text,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏗 Объект:' || E'\n' || COALESCE(NULLIF(obj_name,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель:' || E'\n' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🔧 Исполнитель:' || E'\n' || COALESCE(NULLIF(r.executor,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('📌 Статус:' || E'\n' || COALESCE(NULLIF(r.status,''), 'Новая заявка'))::text;
  RETURN array_to_string(parts, E'\n');
END;
$function$;

-- Helper callable by edge function to build the message from a request id
CREATE OR REPLACE FUNCTION public.build_assigned_message_by_id(_request_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.requests;
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.build_assigned_message_v2(r);
END;
$function$;

-- Suppress the duplicate "status_changed" notification on the Входящая → Новая
-- assignment transition (assign-executor edits the original message in place).
CREATE OR REPLACE FUNCTION public.notify_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t text;
  is_assignment boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Входящая заявка' THEN
      t := public.build_incoming_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.incoming', 'request', NEW.id::text, t,
        jsonb_build_object(
          'buttons', public.get_executor_buttons(NEW.organization_id),
          'request_id', NEW.id,
          'kind', 'incoming',
          'source_trigger', 'notify_request_event:insert'
        ),
        NULL
      );
    ELSE
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.created', 'request', NEW.id::text, t,
        jsonb_build_object('request_number', NEW.request_number, 'priority', NEW.priority, 'source_trigger', 'notify_request_event:insert'), NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    is_assignment := (OLD.status = 'Входящая заявка' AND NEW.status = 'Новая заявка');

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Skip status_changed entirely on assignment — assign-executor edits the
      -- original incoming message in place with the assigned template.
      IF NOT is_assignment THEN
        t := public.build_request_message(NEW);
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'request.status_changed', 'request', NEW.id::text, t,
          jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'source_trigger', 'notify_request_event:status_change'), NEW.status
        );
      END IF;

      IF NEW.status = 'Доставлено' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'supply.arrived', 'request', NEW.id::text,
          public.build_request_message(NEW), jsonb_build_object('source_trigger', 'notify_request_event:arrived'), 'arrived'
        );
      END IF;
    END IF;

    -- Standalone executor change (NOT part of the assignment transition)
    IF OLD.executor IS DISTINCT FROM NEW.executor AND NEW.executor IS NOT NULL AND NOT is_assignment THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.executor_assigned', 'request', NEW.id::text, t,
        jsonb_build_object('source_trigger', 'notify_request_event:executor_changed'), NEW.executor
      );
    END IF;

    IF OLD.invoice_number IS NULL AND NEW.invoice_number IS NOT NULL THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.created', 'request', NEW.id::text, t,
        jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.amount, 'source_trigger', 'notify_request_event:invoice_created'), NEW.invoice_number
      );
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.payment_changed', 'request', NEW.id::text, t,
        jsonb_build_object('source_trigger', 'notify_request_event:payment_changed'), NEW.payment_status
      );
      IF NEW.payment_status ILIKE '%просроч%' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'invoice.overdue', 'request', NEW.id::text,
          '⚠️ Просрочка оплаты' || E'\n\n' || public.build_request_message(NEW),
          jsonb_build_object('source_trigger', 'notify_request_event:overdue'), 'overdue'
        );
      END IF;
    END IF;

    IF (OLD.photo_url IS NULL AND NEW.photo_url IS NOT NULL)
       OR (OLD.document_url IS NULL AND NEW.document_url IS NOT NULL) THEN
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'supply.attachment_added', 'request', NEW.id::text,
        '📎 Загружено вложение' || E'\n\n' || public.build_request_message(NEW),
        jsonb_build_object('source_trigger', 'notify_request_event:attachment'), COALESCE(NEW.photo_url, NEW.document_url)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;