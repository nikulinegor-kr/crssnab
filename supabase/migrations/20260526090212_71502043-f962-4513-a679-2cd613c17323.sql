
CREATE OR REPLACE FUNCTION public.notify_request_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t text;
  is_assignment boolean := false;
  invoice_should_fire boolean := false;
  status_msg_suppressed boolean := false;
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

    invoice_should_fire := (
      lower(coalesce(NEW.status,'')) = lower('Счёт в Бухгалтерии')
      AND NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> ''
      AND (
        lower(coalesce(OLD.status,'')) IS DISTINCT FROM lower('Счёт в Бухгалтерии')
        OR (OLD.invoice_number IS NULL OR OLD.invoice_number = '')
      )
    );

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Skip generic status_changed when a more specific event will cover it:
      --   * "Доставлено" → supply.arrived handles it
      --   * "Счёт в Бухгалтерии" + invoice number → invoice.created handles it
      IF NEW.status = 'Доставлено' THEN
        status_msg_suppressed := true;
      ELSIF invoice_should_fire THEN
        status_msg_suppressed := true;
      END IF;

      IF NOT status_msg_suppressed THEN
        IF is_assignment THEN
          t := public.build_assigned_message_v2(NEW);
        ELSE
          t := public.build_request_message(NEW);
        END IF;
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

    -- Executor changed: only emit if status did NOT change in the same update
    -- (status_changed message already carries the executor info and avoids a duplicate notification).
    IF OLD.executor IS DISTINCT FROM NEW.executor
       AND NEW.executor IS NOT NULL
       AND NOT is_assignment
       AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.executor_assigned', 'request', NEW.id::text, t,
        jsonb_build_object('source_trigger', 'notify_request_event:executor_changed'), NEW.executor
      );
    END IF;

    IF invoice_should_fire THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.created', 'request', NEW.id::text, t,
        jsonb_build_object(
          'invoice_number', NEW.invoice_number,
          'amount', NEW.amount,
          'request_id', NEW.id,
          'kind', 'invoice_route',
          'buttons', jsonb_build_array(
            jsonb_build_object('name','💰 В оплату','data', 'invroute:' || NEW.id::text || ':pay'),
            jsonb_build_object('name','🔧 В ТО','data', 'invroute:' || NEW.id::text || ':to')
          ),
          'source_trigger', 'notify_request_event:invoice_in_accounting'
        ),
        NEW.invoice_number
      );
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
