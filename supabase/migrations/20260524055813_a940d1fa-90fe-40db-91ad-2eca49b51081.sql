
-- Helper: priority emoji
CREATE OR REPLACE FUNCTION public._priority_emoji(_p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(_p,'')) LIKE '%авар%'  THEN '🚨'
    WHEN lower(coalesce(_p,'')) LIKE '%срочн%' THEN '⚡'
    ELSE '⭐'
  END
$$;

-- Helper: status emoji
CREATE OR REPLACE FUNCTION public._status_emoji(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(_s,'')) LIKE '%доставлено в тк%' THEN '📦'
    WHEN lower(coalesce(_s,'')) LIKE '%доставлено%'      THEN '✅'
    WHEN lower(coalesce(_s,'')) LIKE '%в пути%'          THEN '🚚'
    WHEN lower(coalesce(_s,'')) LIKE '%работ%'           THEN '🔧'
    WHEN lower(coalesce(_s,'')) LIKE '%отклонено%'       THEN '❌'
    WHEN lower(coalesce(_s,'')) LIKE '%новая%'           THEN '🆕'
    ELSE '🚚'
  END
$$;

-- Build the full request message (matches notify-telegram standard format)
CREATE OR REPLACE FUNCTION public.build_request_message(r public.requests)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
  block text[];
  tg_username text;
BEGIN
  -- Block 1: description
  parts := parts || ('🧾 Заявка: ' || COALESCE(NULLIF(r.description,''),'#' || r.request_number));

  -- Block 2: priority + status
  block := ARRAY[]::text[];
  IF r.priority IS NOT NULL AND r.priority <> '' THEN
    block := block || (public._priority_emoji(r.priority) || ' Приоритет: ' || r.priority);
  END IF;
  IF r.status IS NOT NULL AND r.status <> '' THEN
    block := block || (public._status_emoji(r.status) || ' Статус: ' || r.status);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || '' || block;
  END IF;

  -- Block 3: applicant + executor
  block := ARRAY[]::text[];
  IF r.applicant IS NOT NULL AND r.applicant <> '' THEN
    block := block || ('👤 Заявитель: ' || r.applicant);
  END IF;
  IF r.executor IS NOT NULL AND r.executor <> '' THEN
    block := block || ('🔧 Исполнитель: ' || r.executor);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || '' || block;
  END IF;

  -- Block 4: contractor + invoice
  block := ARRAY[]::text[];
  IF r.contractor IS NOT NULL AND r.contractor <> '' THEN
    block := block || ('🏢 Контрагент: ' || r.contractor);
  END IF;
  IF r.invoice_number IS NOT NULL AND r.invoice_number <> '' THEN
    block := block || ('📄 № счёта: ' || r.invoice_number);
  END IF;
  IF array_length(block,1) > 0 THEN
    parts := parts || '' || block;
  END IF;

  -- Block 5: logistics
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
    parts := parts || '' || block;
  END IF;

  -- Block 6: comment
  IF r.comments IS NOT NULL AND r.comments <> '' THEN
    parts := parts || '' || ('📝 Комментарий: ' || r.comments);
  END IF;

  -- Trailing telegram mention of applicant
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
      parts := parts || '' || ('@' || tg_username);
    END IF;
  END IF;

  RETURN array_to_string(parts, E'\n');
END;
$$;

-- Update the main request trigger to use the rich formatter
CREATE OR REPLACE FUNCTION public.notify_request_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    t := public.build_request_message(NEW);
    PERFORM public.enqueue_notification(
      NEW.organization_id, 'request.created', 'request', NEW.id::text, t,
      jsonb_build_object('request_number', NEW.request_number, 'priority', NEW.priority), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      t := public.build_request_message(NEW);
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
