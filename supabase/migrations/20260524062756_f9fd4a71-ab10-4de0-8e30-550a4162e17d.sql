-- 1. Strip #REQ from build_assigned_message
CREATE OR REPLACE FUNCTION public.build_assigned_message(r requests)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE parts text[] := ARRAY[]::text[];
BEGIN
  parts := parts || ('🧾 Заявка: ' || COALESCE(NULLIF(r.description,''),'Без названия'))::text;
  parts := parts || ''::text;
  parts := parts || (public._priority_emoji(r.priority) || ' Приоритет: ' || COALESCE(NULLIF(r.priority,''), '—'))::text;
  parts := parts || ('📌 Статус: ' || COALESCE(NULLIF(r.status,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель: ' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  parts := parts || ('🔧 Исполнитель: ' || COALESCE(NULLIF(r.executor,''), '—'))::text;
  IF r.contractor IS NOT NULL AND r.contractor <> '' THEN
    parts := parts || ''::text;
    parts := parts || ('🏢 Контрагент: ' || r.contractor)::text;
  END IF;
  RETURN array_to_string(parts, E'\n');
END;
$function$;

-- 2. Strip #REQ from build_incoming_message_v2 (it currently doesn't include it, but ensure title fallback isn't '#...')
CREATE OR REPLACE FUNCTION public.build_incoming_message_v2(r requests)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts text[] := ARRAY[]::text[];
  obj_name text;
BEGIN
  SELECT name INTO obj_name FROM public.material_objects WHERE id = r.object_id;

  parts := parts || '🧾 Входящая заявка'::text;
  parts := parts || ''::text;
  parts := parts || ('Название:' || E'\n' || COALESCE(NULLIF(r.description,''), 'Без названия'))::text;
  parts := parts || ''::text;
  parts := parts || ('⭐ Приоритет:' || E'\n' || COALESCE(NULLIF(r.priority::text,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏗 Объект:' || E'\n' || COALESCE(NULLIF(obj_name,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель:' || E'\n' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  IF r.comments IS NOT NULL AND r.comments <> '' THEN
    parts := parts || ''::text;
    parts := parts || ('💬 Комментарий:' || E'\n' || r.comments)::text;
  END IF;
  RETURN array_to_string(parts, E'\n');
END;
$function$;

-- 3. Strip #REQ from build_request_message (title + remove @username trailing identifier intact)
CREATE OR REPLACE FUNCTION public.build_request_message(r requests)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts text[] := ARRAY[]::text[];
  block text[];
  tg_username text;
BEGIN
  parts := parts || ('🧾 Заявка: ' || COALESCE(NULLIF(r.description,''),'Без названия'));

  block := ARRAY[]::text[];
  IF r.priority IS NOT NULL AND r.priority <> '' THEN
    block := block || (public._priority_emoji(r.priority) || ' Приоритет: ' || r.priority);
  END IF;
  IF r.status IS NOT NULL AND r.status <> '' THEN
    block := block || (public._status_emoji(r.status) || ' Статус: ' || r.status);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || ''::text || block;
  END IF;

  block := ARRAY[]::text[];
  IF r.applicant IS NOT NULL AND r.applicant <> '' THEN
    block := block || ('👤 Заявитель: ' || r.applicant);
  END IF;
  IF r.executor IS NOT NULL AND r.executor <> '' THEN
    block := block || ('🔧 Исполнитель: ' || r.executor);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || ''::text || block;
  END IF;

  block := ARRAY[]::text[];
  IF r.contractor IS NOT NULL AND r.contractor <> '' THEN
    block := block || ('🏢 Контрагент: ' || r.contractor);
  END IF;
  IF r.invoice_number IS NOT NULL AND r.invoice_number <> '' THEN
    block := block || ('📄 № счёта: ' || r.invoice_number);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || ''::text || block;
  END IF;

  block := ARRAY[]::text[];
  IF r.transport_company IS NOT NULL AND r.transport_company <> '' THEN
    block := block || ('🚛 ТК: ' || r.transport_company);
  END IF;
  IF r.waybill_number IS NOT NULL AND r.waybill_number <> '' THEN
    block := block || ('📄 № ТТН: ' || r.waybill_number);
  END IF;
  IF r.shipment_date IS NOT NULL THEN
    block := block || ('📅 Дата отгрузки: ' || to_char(r.shipment_date, 'DD.MM.YYYY'));
  END IF;
  IF r.delivery_date IS NOT NULL THEN
    block := block || ('📅 Дата прибытия: ' || to_char(r.delivery_date, 'DD.MM.YYYY'));
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || ''::text || block;
  END IF;

  IF r.comments IS NOT NULL AND r.comments <> '' THEN
    parts := parts || ''::text || ('📝 Комментарий: ' || r.comments);
  END IF;

  IF r.applicant IS NOT NULL AND r.applicant <> '' THEN
    SELECT telegram_username INTO tg_username
    FROM public.request_participants
    WHERE organization_id = r.organization_id
      AND name = r.applicant
      AND participant_type = 'applicant'
      AND telegram_username IS NOT NULL
      AND telegram_username <> ''
    LIMIT 1;
    IF tg_username IS NOT NULL THEN
      parts := parts || ''::text || ('@' || tg_username);
    END IF;
  END IF;

  RETURN array_to_string(parts, E'\n');
END;
$function$;

-- 4. Fix duplicate: when transitioning Входящая → Новая, suppress separate executor_assigned notification
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
    -- Detect the Входящая → Новая assignment transition
    is_assignment := (OLD.status = 'Входящая заявка' AND NEW.status = 'Новая заявка');

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF is_assignment THEN
        t := public.build_assigned_message(NEW);
      ELSE
        t := public.build_request_message(NEW);
      END IF;
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.status_changed', 'request', NEW.id::text, t,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'source_trigger', 'notify_request_event:status_change'), NEW.status
      );

      IF NEW.status = 'Доставлено' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'supply.arrived', 'request', NEW.id::text,
          public.build_request_message(NEW), jsonb_build_object('source_trigger', 'notify_request_event:arrived'), 'arrived'
        );
      END IF;
    END IF;

    -- Suppress separate executor_assigned notification when it's part of the Входящая→Новая transition
    -- (status_changed already carries the assigned message). Only fire on standalone executor changes.
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