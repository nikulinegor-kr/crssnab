-- 1. Schema for tracking provider message ids (needed to edit/remove buttons after assignment)
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_chat_id text;

-- 2. Reassign existing "Входящие заявки" group to a dedicated notification type
UPDATE public.max_groups
SET notification_type = 'incoming'
WHERE group_id = '-75086536078021';

-- 3. Update routing rules for any existing org
UPDATE public.notification_routing_rules
SET notification_type = 'supply'
WHERE event_type IN (
  'request.created','request.status_changed','request.comment_added','request.executor_assigned',
  'supply.attachment_added','supply.cargo_moved','supply.arrived'
);

INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, description, is_enabled)
SELECT DISTINCT organization_id, 'request.incoming', 'incoming', 'Новая входящая заявка (с выбором исполнителя)', true
FROM public.notification_routing_rules
ON CONFLICT (organization_id, event_type) DO UPDATE
SET notification_type = EXCLUDED.notification_type,
    description = EXCLUDED.description;

-- 4. Update the seed for future orgs
CREATE OR REPLACE FUNCTION public.seed_notification_routing(_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, description) VALUES
    (_org_id, 'request.incoming',          'incoming','Новая входящая заявка (выбор исполнителя)'),
    (_org_id, 'request.created',           'supply',  'Создана новая заявка'),
    (_org_id, 'request.status_changed',    'supply',  'Изменён статус заявки'),
    (_org_id, 'request.comment_added',     'supply',  'Новый комментарий к заявке'),
    (_org_id, 'request.executor_assigned', 'supply',  'Назначен исполнитель'),
    (_org_id, 'invoice.created',           'invoice', 'Добавлен счёт'),
    (_org_id, 'invoice.overdue',           'invoice', 'Просрочка оплаты'),
    (_org_id, 'invoice.payment_changed',   'invoice', 'Изменён статус оплаты'),
    (_org_id, 'supply.arrived',            'supply',  'Груз доставлен'),
    (_org_id, 'supply.cargo_moved',        'supply',  'Перемещение груза'),
    (_org_id, 'supply.attachment_added',   'supply',  'Загружено фото/документ'),
    (_org_id, 'alert.system_error',        'alert',   'Системная ошибка CRM'),
    (_org_id, 'alert.webhook_error',       'alert',   'Ошибка webhook')
  ON CONFLICT (organization_id, event_type) DO NOTHING;
END;
$$;

-- 5. Message builders
CREATE OR REPLACE FUNCTION public.build_incoming_message(r public.requests)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE parts text[] := ARRAY[]::text[];
BEGIN
  parts := parts || '🧾 Входящая заявка'::text;
  parts := parts || ''::text;
  parts := parts || ('Название:' || E'\n' || COALESCE(NULLIF(r.description,''),'#' || r.request_number))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель:' || E'\n' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏢 Контрагент:' || E'\n' || COALESCE(NULLIF(r.contractor,''), '—'))::text;
  IF r.comments IS NOT NULL AND r.comments <> '' THEN
    parts := parts || ''::text;
    parts := parts || ('💬 Комментарий:' || E'\n' || r.comments)::text;
  END IF;
  parts := parts || ''::text;
  parts := parts || ('#' || r.request_number)::text;
  RETURN array_to_string(parts, E'\n');
END;
$$;

CREATE OR REPLACE FUNCTION public.build_assigned_message(r public.requests)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE parts text[] := ARRAY[]::text[];
BEGIN
  parts := parts || ('🧾 Заявка: ' || COALESCE(NULLIF(r.description,''),'#' || r.request_number))::text;
  parts := parts || ''::text;
  parts := parts || (public._priority_emoji(r.priority) || ' Приоритет: ' || COALESCE(NULLIF(r.priority,''), '—'))::text;
  parts := parts || ('📌 Статус: ' || COALESCE(NULLIF(r.status,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель: ' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  parts := parts || ('🔧 Исполнитель: ' || COALESCE(NULLIF(r.executor,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏢 Контрагент: ' || COALESCE(NULLIF(r.contractor,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('#' || r.request_number)::text;
  RETURN array_to_string(parts, E'\n');
END;
$$;

-- 6. Executor buttons helper
CREATE OR REPLACE FUNCTION public.get_executor_buttons(_org_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name),
    '[]'::jsonb
  )
  FROM public.request_participants
  WHERE organization_id = _org_id
    AND participant_type = 'executor'
    AND is_active = true
$$;

-- 7. Branch the request event trigger to support the incoming flow + use assigned-message after the Входящая→Новая jump
CREATE OR REPLACE FUNCTION public.notify_request_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Входящая заявка' THEN
      t := public.build_incoming_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.incoming', 'request', NEW.id::text, t,
        jsonb_build_object(
          'buttons', public.get_executor_buttons(NEW.organization_id),
          'request_id', NEW.id,
          'kind', 'incoming'
        ),
        NULL
      );
    ELSE
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.created', 'request', NEW.id::text, t,
        jsonb_build_object('request_number', NEW.request_number, 'priority', NEW.priority), NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status = 'Входящая заявка' AND NEW.status = 'Новая заявка' THEN
        t := public.build_assigned_message(NEW);
      ELSE
        t := public.build_request_message(NEW);
      END IF;
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.status_changed', 'request', NEW.id::text, t,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status), NEW.status
      );

      IF NEW.status = 'Доставлено' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'supply.arrived', 'request', NEW.id::text,
          public.build_request_message(NEW), '{}'::jsonb, 'arrived'
        );
      END IF;
    END IF;

    IF OLD.executor IS DISTINCT FROM NEW.executor AND NEW.executor IS NOT NULL THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.executor_assigned', 'request', NEW.id::text, t,
        '{}'::jsonb, NEW.executor
      );
    END IF;

    IF OLD.invoice_number IS NULL AND NEW.invoice_number IS NOT NULL THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.created', 'request', NEW.id::text, t,
        jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.amount), NEW.invoice_number
      );
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      t := public.build_request_message(NEW);
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.payment_changed', 'request', NEW.id::text, t,
        '{}'::jsonb, NEW.payment_status
      );
      IF NEW.payment_status ILIKE '%просроч%' THEN
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'invoice.overdue', 'request', NEW.id::text,
          '⚠️ Просрочка оплаты' || E'\n\n' || public.build_request_message(NEW),
          '{}'::jsonb, 'overdue'
        );
      END IF;
    END IF;

    IF (OLD.photo_url IS NULL AND NEW.photo_url IS NOT NULL)
       OR (OLD.document_url IS NULL AND NEW.document_url IS NOT NULL) THEN
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'supply.attachment_added', 'request', NEW.id::text,
        '📎 Загружено вложение' || E'\n\n' || public.build_request_message(NEW),
        '{}'::jsonb, COALESCE(NEW.photo_url, NEW.document_url)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;