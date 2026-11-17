CREATE OR REPLACE FUNCTION public.notify_request_max_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q public.requests;
  actor_id uuid := auth.uid();
  actor_name text;
  actor_email text;
  actor_label text;
  event_name text;
  message_text text;
  old_object text;
  new_object text;
  old_warehouse text;
  new_warehouse text;
  details jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    q := OLD;
    event_name := 'request.deleted';
  ELSE
    IF OLD.object_id IS NOT DISTINCT FROM NEW.object_id
       AND OLD.warehouse_id IS NOT DISTINCT FROM NEW.warehouse_id THEN RETURN NEW; END IF;
    q := NEW;
    event_name := 'request.transferred';
  END IF;
  SELECT nullif(btrim(full_name), ''), nullif(btrim(email), '')
    INTO actor_name, actor_email FROM public.profiles WHERE id = actor_id;
  actor_email := coalesce(actor_email, nullif(auth.jwt()->>'email', ''));
  actor_label := CASE WHEN actor_id IS NULL THEN 'Системная операция'
    ELSE coalesce(actor_name, 'Пользователь') || ' (' || coalesce(actor_email, actor_id::text) || ')' END;
  SELECT name INTO old_object FROM public.request_objects WHERE id = OLD.object_id AND organization_id = q.organization_id;
  SELECT name INTO old_warehouse FROM public.warehouses WHERE id = OLD.warehouse_id AND organization_id = q.organization_id;
  IF TG_OP = 'UPDATE' THEN
    SELECT name INTO new_object FROM public.request_objects WHERE id = NEW.object_id AND organization_id = q.organization_id;
    SELECT name INTO new_warehouse FROM public.warehouses WHERE id = NEW.warehouse_id AND organization_id = q.organization_id;
  END IF;
  message_text := CASE WHEN TG_OP = 'DELETE' THEN '🗑 Заявка удалена навсегда' ELSE '↔ Заявка перенесена' END
    || E'\nНомер: ' || coalesce(q.request_number, '—')
    || E'\nЗаявка: ' || coalesce(q.description, '—');
  IF TG_OP = 'DELETE' THEN
    message_text := message_text || E'\nОбъект: ' || coalesce(old_object, '—');
  ELSE
    message_text := message_text || E'\nОбъект: ' || coalesce(old_object, '—') || ' → ' || coalesce(new_object, '—')
      || E'\nСклад: ' || coalesce(old_warehouse, '—') || ' → ' || coalesce(new_warehouse, '—');
  END IF;
  message_text := message_text || E'\nВыполнил: ' || actor_label;
  details := jsonb_build_object('text', message_text, 'request_number', q.request_number,
    'description', q.description, 'actor_id', actor_id, 'actor_name', actor_name, 'actor_email', actor_email,
    'old_object', coalesce(old_object, '—'), 'new_object', coalesce(new_object, '—'),
    'old_warehouse', coalesce(old_warehouse, '—'), 'new_warehouse', coalesce(new_warehouse, '—'),
    'occurred_at', clock_timestamp(), 'source_trigger', 'notify_request_max_action');
  INSERT INTO public.notification_queue(organization_id, event_type, entity_type, entity_id,
    platform, group_id, group_name, payload, status, dedup_key)
  SELECT q.organization_id, event_name, 'request', q.id::text, 'max', g.group_id, g.group_name,
    details, CASE WHEN public.get_notification_mode(q.organization_id) = 'production' THEN 'queued' ELSE 'skipped' END,
    q.organization_id::text || ':' || event_name || ':' || q.id::text || ':' || txid_current()::text
  FROM public.max_groups g
  WHERE g.organization_id = q.organization_id AND g.notification_type = 'supply' AND g.is_active = true;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_request_max_action() FROM PUBLIC;
CREATE TRIGGER trg_request_max_action AFTER DELETE OR UPDATE OF object_id, warehouse_id
ON public.requests FOR EACH ROW EXECUTE FUNCTION public.notify_request_max_action();