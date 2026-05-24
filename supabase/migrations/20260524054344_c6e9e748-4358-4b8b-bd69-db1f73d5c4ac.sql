
-- ============================================
-- 1. notification_settings
-- ============================================
CREATE TABLE public.notification_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test','production')),
  dedup_window_seconds INTEGER NOT NULL DEFAULT 30,
  max_per_minute INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view notification_settings"
  ON public.notification_settings FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "admins manage notification_settings"
  ON public.notification_settings FOR ALL TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- ============================================
-- 2. notification_routing_rules
-- ============================================
CREATE TABLE public.notification_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, event_type)
);
CREATE INDEX idx_routing_rules_org ON public.notification_routing_rules(organization_id);

ALTER TABLE public.notification_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view routing_rules"
  ON public.notification_routing_rules FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "admins manage routing_rules"
  ON public.notification_routing_rules FOR ALL TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- ============================================
-- 3. notification_queue
-- ============================================
CREATE TABLE public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('max','telegram')),
  group_id TEXT NOT NULL,
  group_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','delivered','failed','skipped')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  last_http_code INTEGER,
  last_response TEXT,
  dedup_key TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_status_next ON public.notification_queue(status, next_attempt_at);
CREATE INDEX idx_queue_org_created ON public.notification_queue(organization_id, created_at DESC);
CREATE INDEX idx_queue_dedup ON public.notification_queue(dedup_key);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view queue"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "admins update queue (retry)"
  ON public.notification_queue FOR UPDATE TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- ============================================
-- 4. notification_dedup
-- ============================================
CREATE TABLE public.notification_dedup (
  dedup_key TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dedup_expires ON public.notification_dedup(expires_at);

ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;
-- Only service role writes; admins can view if needed
CREATE POLICY "admins view dedup"
  ON public.notification_dedup FOR SELECT TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id));

-- ============================================
-- 5. notification_health
-- ============================================
CREATE TABLE public.notification_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  component TEXT NOT NULL CHECK (component IN ('max_api','telegram_api','max_webhook','telegram_webhook','edge_functions')),
  status TEXT NOT NULL CHECK (status IN ('ok','degraded','down','unknown')),
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  latency_ms INTEGER,
  UNIQUE (organization_id, component)
);

ALTER TABLE public.notification_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members view health"
  ON public.notification_health FOR SELECT TO authenticated
  USING (organization_id IS NULL OR user_has_org_access(auth.uid(), organization_id));

-- ============================================
-- 6. updated_at triggers
-- ============================================
CREATE TRIGGER trg_notification_settings_updated
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_routing_rules_updated
  BEFORE UPDATE ON public.notification_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_queue_updated
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. Helpers
-- ============================================

-- Get effective mode (defaults to 'test' if no row)
CREATE OR REPLACE FUNCTION public.get_notification_mode(_org_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT mode FROM public.notification_settings WHERE organization_id = _org_id), 'test')
$$;

-- Core enqueue function: called by DB triggers and edge functions
-- Looks up routing rule + active groups for both platforms, applies dedup, inserts queue rows.
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _org_id UUID,
  _event_type TEXT,
  _entity_type TEXT,
  _entity_id TEXT,
  _text TEXT,
  _payload JSONB DEFAULT '{}'::jsonb,
  _dedup_suffix TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rule RECORD;
  grp RECORD;
  inserted_count INTEGER := 0;
  dedup_window INTEGER;
  mode_value TEXT;
  d_key TEXT;
BEGIN
  -- Skip in test mode (still log to queue with status=skipped so it's visible)
  mode_value := public.get_notification_mode(_org_id);

  SELECT * INTO rule
  FROM public.notification_routing_rules
  WHERE organization_id = _org_id AND event_type = _event_type AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(dedup_window_seconds, 30) INTO dedup_window
  FROM public.notification_settings WHERE organization_id = _org_id;
  dedup_window := COALESCE(dedup_window, 30);

  d_key := _org_id::text || ':' || _event_type || ':' || COALESCE(_entity_id, '') || ':' || COALESCE(_dedup_suffix, '');

  -- Dedup check
  IF EXISTS (SELECT 1 FROM public.notification_dedup WHERE dedup_key = d_key AND expires_at > now()) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notification_dedup(dedup_key, organization_id, expires_at)
  VALUES (d_key, _org_id, now() + (dedup_window || ' seconds')::interval)
  ON CONFLICT (dedup_key) DO NOTHING;

  -- MAX groups
  FOR grp IN
    SELECT group_id, group_name FROM public.max_groups
    WHERE organization_id = _org_id AND notification_type = rule.notification_type AND is_active = true
  LOOP
    INSERT INTO public.notification_queue (
      organization_id, event_type, entity_type, entity_id, platform,
      group_id, group_name, payload, status, dedup_key
    ) VALUES (
      _org_id, _event_type, _entity_type, _entity_id, 'max',
      grp.group_id, grp.group_name,
      jsonb_build_object('text', _text) || _payload,
      CASE WHEN mode_value = 'production' THEN 'queued' ELSE 'skipped' END,
      d_key
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  -- Telegram groups
  FOR grp IN
    SELECT group_id, group_name FROM public.telegram_groups
    WHERE organization_id = _org_id AND notification_type = rule.notification_type AND is_active = true
  LOOP
    INSERT INTO public.notification_queue (
      organization_id, event_type, entity_type, entity_id, platform,
      group_id, group_name, payload, status, dedup_key
    ) VALUES (
      _org_id, _event_type, _entity_type, _entity_id, 'telegram',
      grp.group_id, grp.group_name,
      jsonb_build_object('text', _text) || _payload,
      CASE WHEN mode_value = 'production' THEN 'queued' ELSE 'skipped' END,
      d_key
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Seed default routing rules for an organization
CREATE OR REPLACE FUNCTION public.seed_notification_routing(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, description) VALUES
    (_org_id, 'request.created',           'request',  'Создана новая заявка'),
    (_org_id, 'request.status_changed',    'request',  'Изменён статус заявки'),
    (_org_id, 'request.comment_added',     'request',  'Новый комментарий к заявке'),
    (_org_id, 'request.executor_assigned', 'request',  'Назначен исполнитель'),
    (_org_id, 'invoice.created',           'invoice',  'Добавлен счёт'),
    (_org_id, 'invoice.overdue',           'invoice',  'Просрочка оплаты'),
    (_org_id, 'invoice.payment_changed',   'invoice',  'Изменён статус оплаты'),
    (_org_id, 'supply.arrived',            'supply',   'Груз доставлен'),
    (_org_id, 'supply.cargo_moved',        'supply',   'Перемещение груза'),
    (_org_id, 'supply.attachment_added',   'supply',   'Загружено фото/документ'),
    (_org_id, 'alert.system_error',        'alert',    'Системная ошибка CRM'),
    (_org_id, 'alert.webhook_error',       'alert',    'Ошибка webhook')
  ON CONFLICT (organization_id, event_type) DO NOTHING;
END;
$$;

-- Auto-seed for existing orgs
DO $$
DECLARE o RECORD;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_notification_routing(o.id);
    INSERT INTO public.notification_settings(organization_id) VALUES (o.id)
      ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END$$;

-- ============================================
-- 8. CRM event triggers
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_request_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    t := '🆕 Новая заявка #' || NEW.request_number || E'\n' || COALESCE(NEW.description, '');
    PERFORM public.enqueue_notification(
      NEW.organization_id, 'request.created', 'request', NEW.id::text, t,
      jsonb_build_object('request_number', NEW.request_number, 'priority', NEW.priority), NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      t := '🔄 Заявка #' || NEW.request_number || E'\nСтатус: ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—');
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.status_changed', 'request', NEW.id::text, t,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status), NEW.status
      );

      IF NEW.status = 'Доставлено' THEN
        t := '✅ Груз доставлен по заявке #' || NEW.request_number || E'\n' || COALESCE(NEW.description, '');
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'supply.arrived', 'request', NEW.id::text, t, '{}'::jsonb, 'arrived'
        );
      END IF;
    END IF;

    IF OLD.executor IS DISTINCT FROM NEW.executor AND NEW.executor IS NOT NULL THEN
      t := '👤 Заявка #' || NEW.request_number || E'\nНазначен исполнитель: ' || NEW.executor;
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'request.executor_assigned', 'request', NEW.id::text, t,
        '{}'::jsonb, NEW.executor
      );
    END IF;

    IF OLD.invoice_number IS NULL AND NEW.invoice_number IS NOT NULL THEN
      t := '💳 Новый счёт №' || NEW.invoice_number || E'\nПо заявке #' || NEW.request_number ||
           CASE WHEN NEW.amount IS NOT NULL THEN E'\nСумма: ' || NEW.amount::text || ' ₽' ELSE '' END;
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.created', 'request', NEW.id::text, t,
        jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.amount), NEW.invoice_number
      );
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      t := '💰 Заявка #' || NEW.request_number || E'\nОплата: ' || COALESCE(OLD.payment_status,'—') || ' → ' || COALESCE(NEW.payment_status,'—');
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'invoice.payment_changed', 'request', NEW.id::text, t,
        '{}'::jsonb, NEW.payment_status
      );
      IF NEW.payment_status ILIKE '%просроч%' THEN
        t := '⚠️ Просрочка оплаты по заявке #' || NEW.request_number;
        PERFORM public.enqueue_notification(
          NEW.organization_id, 'invoice.overdue', 'request', NEW.id::text, t, '{}'::jsonb, 'overdue'
        );
      END IF;
    END IF;

    IF (OLD.photo_url IS NULL AND NEW.photo_url IS NOT NULL)
       OR (OLD.document_url IS NULL AND NEW.document_url IS NOT NULL) THEN
      t := '📎 Заявка #' || NEW.request_number || E'\nЗагружено вложение';
      PERFORM public.enqueue_notification(
        NEW.organization_id, 'supply.attachment_added', 'request', NEW.id::text, t,
        '{}'::jsonb, COALESCE(NEW.photo_url, NEW.document_url)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_requests_notify_event
  AFTER INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_request_event();

-- request_comments trigger
CREATE OR REPLACE FUNCTION public.notify_request_comment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
  t TEXT;
BEGIN
  SELECT organization_id, request_number INTO r FROM public.requests WHERE id = NEW.request_id;
  IF r.organization_id IS NULL THEN RETURN NEW; END IF;
  t := '💬 Новый комментарий к заявке #' || r.request_number || E'\n' || LEFT(NEW.content, 500);
  PERFORM public.enqueue_notification(
    r.organization_id, 'request.comment_added', 'request', NEW.request_id::text, t,
    jsonb_build_object('comment_id', NEW.id), NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_request_comments_notify
  AFTER INSERT ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_request_comment();

-- stock_movements trigger (cargo moves)
CREATE OR REPLACE FUNCTION public.notify_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t TEXT;
BEGIN
  IF NEW.type IN ('MOVE_IN','MOVE_OUT') THEN
    t := '🚚 Перемещение груза' ||
         CASE WHEN NEW.comment IS NOT NULL THEN E'\n' || NEW.comment ELSE '' END ||
         E'\nКол-во: ' || COALESCE(NEW.quantity::text, '—');
    PERFORM public.enqueue_notification(
      NEW.organization_id, 'supply.cargo_moved', 'stock_movement', NEW.id::text, t,
      jsonb_build_object('type', NEW.type, 'quantity', NEW.quantity), NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movements_notify
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.notify_stock_movement();

-- Cleanup expired dedup keys (runs opportunistically)
CREATE OR REPLACE FUNCTION public.cleanup_notification_dedup()
RETURNS VOID
LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.notification_dedup WHERE expires_at < now() - interval '1 hour';
$$;
