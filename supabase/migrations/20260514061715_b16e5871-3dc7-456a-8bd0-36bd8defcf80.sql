
-- 1. Notification log (anti-duplicate)
CREATE TABLE public.request_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('shipment_tomorrow','arrival_3d','arrival_1d','arrival_today','overdue')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID,
  telegram_message_id BIGINT,
  forced BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (request_id, notification_type)
);

CREATE INDEX idx_rnl_request ON public.request_notification_log(request_id);
CREATE INDEX idx_rnl_org ON public.request_notification_log(organization_id);

ALTER TABLE public.request_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read notification log"
  ON public.request_notification_log FOR SELECT
  USING (public.user_has_org_access(auth.uid(), organization_id));

-- inserts/updates only via service role (edge function); no policies for INSERT/UPDATE/DELETE => denied

-- 2. Schedule settings per organization
CREATE TABLE public.notification_schedule_settings (
  organization_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notify_shipment_tomorrow BOOLEAN NOT NULL DEFAULT true,
  notify_arrival_3d BOOLEAN NOT NULL DEFAULT true,
  notify_arrival_1d BOOLEAN NOT NULL DEFAULT true,
  notify_arrival_today BOOLEAN NOT NULL DEFAULT true,
  notify_overdue BOOLEAN NOT NULL DEFAULT true,
  send_time TIME NOT NULL DEFAULT '09:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read schedule settings"
  ON public.notification_schedule_settings FOR SELECT
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins insert schedule settings"
  ON public.notification_schedule_settings FOR INSERT
  WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins update schedule settings"
  ON public.notification_schedule_settings FOR UPDATE
  USING (public.user_is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_nss_updated_at
  BEFORE UPDATE ON public.notification_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Actual arrival date on requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS actual_arrival_date TIMESTAMPTZ;

-- Trigger to set actual_arrival_date when status -> Доставлено
CREATE OR REPLACE FUNCTION public.set_actual_arrival_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Доставлено' AND (OLD.status IS DISTINCT FROM 'Доставлено') AND NEW.actual_arrival_date IS NULL THEN
    NEW.actual_arrival_date := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_actual_arrival ON public.requests;
CREATE TRIGGER trg_set_actual_arrival
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_actual_arrival_date();
