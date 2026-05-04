CREATE OR REPLACE FUNCTION public.check_request_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  setting RECORD;
  req RECORD;
  msg_text TEXT;
  title_text TEXT;
BEGIN
  FOR setting IN
    SELECT * FROM public.deadline_reminder_settings
    WHERE is_enabled = true
  LOOP
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
      title_text := COALESCE(NULLIF(TRIM(req.description), ''), 'Заявка #' || req.request_number);
      msg_text := 'Дедлайн через ' || setting.days_before || ' дн. (#' || req.request_number || ')';

      IF req.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id, organization_id, type, title, message, link
        ) VALUES (
          req.created_by, setting.organization_id, 'deadline_reminder',
          title_text, msg_text, '/requests/' || req.id
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;