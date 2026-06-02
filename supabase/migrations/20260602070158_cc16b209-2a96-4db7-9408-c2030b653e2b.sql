CREATE OR REPLACE FUNCTION public.notify_request_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t text;
  is_assignment boolean := false;
  status_msg_suppressed boolean := false;
  delivery_buttons jsonb := NULL;
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

    -- Only notify on status change. All other field updates (executor, invoice, attachments) are silent.
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'Доставлено' THEN
        status_msg_suppressed := true;
      END IF;

      IF NOT status_msg_suppressed THEN
        IF is_assignment THEN
          t := public.build_assigned_message_v2(NEW);
        ELSE
          t := public.build_request_message(NEW);
        END IF;

        IF lower(coalesce(NEW.status,'')) = lower('Доставлено в ТК') THEN
          delivery_buttons := jsonb_build_array(
            jsonb_build_object('name', '📦 Получение подтверждено', 'data', 'delivrcv:' || NEW.id::text),
            jsonb_build_object('name', '🔄 Изменить статус',         'data', 'chgstatus:' || NEW.id::text)
          );
        END IF;

        PERFORM public.enqueue_notification(
          NEW.organization_id, 'request.status_changed', 'request', NEW.id::text, t,
          jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'request_id', NEW.id,
            'kind', CASE WHEN delivery_buttons IS NOT NULL THEN 'delivery_confirm' ELSE 'status_changed' END,
            'buttons', delivery_buttons,
            'source_trigger', 'notify_request_event:status_change'
          ),
          NEW.status
        );
      END IF;

      IF NEW.status = 'Доставлено' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'supply.arrived', 'request', NEW.id::text,
          public.build_request_message(NEW), jsonb_build_object('source_trigger', 'notify_request_event:arrived'), 'arrived'
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;