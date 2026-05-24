-- 1. Columns for routing state
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS invoice_routing text,
  ADD COLUMN IF NOT EXISTS invoice_routed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_routed_by uuid;

-- 2. Update notify_request_event: add buttons + request_id + kind to invoice.created payload
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
      IF is_assignment THEN
        t := public.build_assigned_message_v2(NEW);
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
        jsonb_build_object(
          'invoice_number', NEW.invoice_number,
          'amount', NEW.amount,
          'request_id', NEW.id,
          'kind', 'invoice_route',
          'buttons', jsonb_build_array(
            jsonb_build_object('name','💰 Отписать в оплату','data', 'invroute:' || NEW.id::text || ':pay'),
            jsonb_build_object('name','🔧 Отписать в ТО','data', 'invroute:' || NEW.id::text || ':to')
          ),
          'source_trigger', 'notify_request_event:invoice_created'
        ),
        NEW.invoice_number
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

-- 3. Seed routing rule for invoice.pay_now for every existing org
INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, description, is_enabled)
SELECT DISTINCT organization_id, 'invoice.pay_now', 'invoice', 'Счёт отписан в оплату — к оплате', true
FROM public.notification_routing_rules
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_routing_rules r2
  WHERE r2.organization_id = notification_routing_rules.organization_id
    AND r2.event_type = 'invoice.pay_now'
);

-- 4. Update seed function so future orgs get the new rule
CREATE OR REPLACE FUNCTION public.seed_notification_routing(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, description) VALUES
    (_org_id, 'request.incoming',          'incoming','Новая входящая заявка (выбор исполнителя)'),
    (_org_id, 'request.created',           'supply',  'Создана новая заявка'),
    (_org_id, 'request.status_changed',    'supply',  'Изменён статус заявки'),
    (_org_id, 'request.comment_added',     'supply',  'Новый комментарий к заявке'),
    (_org_id, 'request.executor_assigned', 'supply',  'Назначен исполнитель'),
    (_org_id, 'invoice.created',           'invoice', 'Добавлен счёт'),
    (_org_id, 'invoice.pay_now',           'invoice', 'Счёт отписан в оплату — к оплате'),
    (_org_id, 'invoice.overdue',           'invoice', 'Просрочка оплаты'),
    (_org_id, 'invoice.payment_changed',   'invoice', 'Изменён статус оплаты'),
    (_org_id, 'supply.arrived',            'supply',  'Прибытие поставки'),
    (_org_id, 'supply.cargo_moved',        'supply',  'Перемещение груза'),
    (_org_id, 'supply.attachment_added',   'supply',  'Добавлено вложение')
  ON CONFLICT DO NOTHING;
END;
$function$;