DROP FUNCTION IF EXISTS public.get_telegram_credentials(uuid);

CREATE FUNCTION public.get_telegram_credentials(_org_id uuid)
RETURNS TABLE(
  telegram_bot_token text,
  telegram_chat_id text,
  telegram_auto_send_on_create boolean,
  telegram_auto_send_on_status_change boolean,
  telegram_invoice_chat_id text,
  telegram_procurement_chat_id text,
  telegram_auto_send_to_procurement boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    bot_token,
    chat_id,
    auto_send_on_create,
    auto_send_on_status_change,
    invoice_chat_id,
    procurement_chat_id,
    auto_send_to_procurement
  FROM telegram_settings 
  WHERE organization_id = _org_id 
    AND user_is_org_admin(auth.uid(), _org_id);
$$;

-- Update the log_request_activity trigger function to save snapshots
CREATE OR REPLACE FUNCTION public.log_request_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.request_activities (
      request_id, organization_id, user_id, action, description, snapshot
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.created_by, 'created', 'Заявка создана', to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'status_changed', 'status', OLD.status, NEW.status,
        'Статус изменён с "' || COALESCE(OLD.status,'') || '" на "' || COALESCE(NEW.status,'') || '"', to_jsonb(OLD));
    END IF;

    IF (OLD.priority IS DISTINCT FROM NEW.priority) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'priority_changed', 'priority', OLD.priority, NEW.priority,
        'Приоритет изменён с "' || COALESCE(OLD.priority,'') || '" на "' || COALESCE(NEW.priority,'') || '"', to_jsonb(OLD));
    END IF;

    IF (OLD.executor IS DISTINCT FROM NEW.executor) THEN
      IF (OLD.executor IS NULL AND NEW.executor IS NOT NULL) THEN
        INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, new_value, description, snapshot)
        VALUES (NEW.id, NEW.organization_id, auth.uid(), 'executor_assigned', 'executor', NEW.executor, 'Назначен исполнитель: ' || NEW.executor, to_jsonb(OLD));
      ELSIF (OLD.executor IS NOT NULL AND NEW.executor IS NULL) THEN
        INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, description, snapshot)
        VALUES (NEW.id, NEW.organization_id, auth.uid(), 'executor_removed', 'executor', OLD.executor, 'Исполнитель удалён: ' || OLD.executor, to_jsonb(OLD));
      ELSE
        INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
        VALUES (NEW.id, NEW.organization_id, auth.uid(), 'executor_changed', 'executor', OLD.executor, NEW.executor,
          'Исполнитель изменён с "' || OLD.executor || '" на "' || NEW.executor || '"', to_jsonb(OLD));
      END IF;
    END IF;

    IF (OLD.amount IS DISTINCT FROM NEW.amount) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'amount',
        COALESCE(OLD.amount::text,''), COALESCE(NEW.amount::text,''),
        'Сумма изменена', to_jsonb(OLD));
    END IF;

    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'payment_status',
        COALESCE(OLD.payment_status,''), COALESCE(NEW.payment_status,''),
        'Статус оплаты изменён', to_jsonb(OLD));
    END IF;

    IF (OLD.payment_percentage IS DISTINCT FROM NEW.payment_percentage) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'payment_percentage',
        COALESCE(OLD.payment_percentage::text,''), COALESCE(NEW.payment_percentage::text,''),
        '% оплаты изменён', to_jsonb(OLD));
    END IF;

    IF (OLD.shipment_date IS DISTINCT FROM NEW.shipment_date) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'shipment_date',
        COALESCE(OLD.shipment_date::text,''), COALESCE(NEW.shipment_date::text,''), 'Дата отгрузки изменена', to_jsonb(OLD));
    END IF;

    IF (OLD.delivery_date IS DISTINCT FROM NEW.delivery_date) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'delivery_date',
        COALESCE(OLD.delivery_date::text,''), COALESCE(NEW.delivery_date::text,''), 'Дата доставки изменена', to_jsonb(OLD));
    END IF;

    IF (OLD.contractor IS DISTINCT FROM NEW.contractor) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'contractor',
        COALESCE(OLD.contractor,''), COALESCE(NEW.contractor,''), 'Контрагент изменён', to_jsonb(OLD));
    END IF;

    IF (OLD.invoice_number IS DISTINCT FROM NEW.invoice_number AND NEW.invoice_number IS NOT NULL) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'invoice_added', 'invoice_number', NEW.invoice_number,
        'Добавлен счёт №' || NEW.invoice_number, to_jsonb(OLD));
    END IF;

    IF (OLD.transport_company IS DISTINCT FROM NEW.transport_company) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'transport_company',
        COALESCE(OLD.transport_company,''), COALESCE(NEW.transport_company,''), 'ТК изменена', to_jsonb(OLD));
    END IF;

    IF (OLD.description IS DISTINCT FROM NEW.description) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'description',
        COALESCE(OLD.description,''), COALESCE(NEW.description,''), 'Описание изменено', to_jsonb(OLD));
    END IF;

    IF (OLD.applicant IS DISTINCT FROM NEW.applicant) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'applicant',
        COALESCE(OLD.applicant,''), COALESCE(NEW.applicant,''), 'Заявитель изменён', to_jsonb(OLD));
    END IF;

    IF (OLD.object_id IS DISTINCT FROM NEW.object_id) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, field_name, old_value, new_value, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'field_changed', 'object_id',
        COALESCE(OLD.object_id::text,''), COALESCE(NEW.object_id::text,''), 'Объект изменён', to_jsonb(OLD));
    END IF;

    IF (OLD.photo_url IS NULL AND NEW.photo_url IS NOT NULL) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'photo_added', 'Добавлено фото', to_jsonb(OLD));
    END IF;

    IF (OLD.document_url IS NULL AND NEW.document_url IS NOT NULL) THEN
      INSERT INTO public.request_activities (request_id, organization_id, user_id, action, description, snapshot)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'document_added', 'Добавлен документ', to_jsonb(OLD));
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;