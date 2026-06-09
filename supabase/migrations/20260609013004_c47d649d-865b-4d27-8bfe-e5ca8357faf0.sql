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

  IF r.received_by IS NOT NULL AND r.received_by <> '' THEN
    parts := parts || ''::text || ('📦 Приёмку осуществил: ' || r.received_by);
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