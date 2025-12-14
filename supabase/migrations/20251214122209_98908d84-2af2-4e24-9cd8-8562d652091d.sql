-- Создаём таблицу для настроек автонапоминаний о дедлайнах
CREATE TABLE IF NOT EXISTS public.deadline_reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL DEFAULT 3,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_executor BOOLEAN NOT NULL DEFAULT true,
  notify_applicant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.deadline_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their org settings"
  ON public.deadline_reminder_settings
  FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage settings"
  ON public.deadline_reminder_settings
  FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_deadline_reminder_settings_updated_at
  BEFORE UPDATE ON public.deadline_reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Функция для проверки дедлайнов и создания уведомлений
CREATE OR REPLACE FUNCTION public.check_request_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  setting RECORD;
  req RECORD;
  target_user_id UUID;
BEGIN
  -- Проходим по всем организациям с включёнными настройками
  FOR setting IN
    SELECT * FROM public.deadline_reminder_settings
    WHERE is_enabled = true
  LOOP
    -- Находим заявки с дедлайном через N дней
    FOR req IN
      SELECT r.*, rp.id as executor_participant_id
      FROM public.requests r
      LEFT JOIN public.request_participants rp 
        ON rp.name = r.executor AND rp.organization_id = r.organization_id
      WHERE r.organization_id = setting.organization_id
        AND r.delivery_date IS NOT NULL
        AND r.status NOT IN ('Доставлено', 'Выполнено', 'Закрыто', 'Отменено')
        AND r.archived = false
        AND r.delivery_date::date = (CURRENT_DATE + (setting.days_before || ' days')::interval)::date
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.link = '/requests/' || r.id
            AND n.type = 'deadline_reminder'
            AND n.created_at::date = CURRENT_DATE
        )
    LOOP
      -- Уведомляем создателя заявки
      IF req.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id,
          organization_id,
          type,
          title,
          message,
          link
        ) VALUES (
          req.created_by,
          setting.organization_id,
          'deadline_reminder',
          'Напоминание о дедлайне',
          'Заявка #' || req.request_number || ' — дедлайн через ' || setting.days_before || ' дн.',
          '/requests/' || req.id
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;