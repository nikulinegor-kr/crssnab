-- Function to check for requests where delivery_date is today and notify users
CREATE OR REPLACE FUNCTION public.check_delivery_arrived()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  req RECORD;
BEGIN
  -- Find requests where delivery_date is today and status indicates it's in transit
  FOR req IN
    SELECT r.*
    FROM public.requests r
    WHERE r.delivery_date IS NOT NULL
      AND r.delivery_date::date = CURRENT_DATE
      AND r.status IN ('В пути', 'Отправлено', 'Доставлено в ТК')
      AND r.archived = false
      -- Avoid duplicate notifications on same day
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.link = '/requests/' || r.id
          AND n.type = 'delivery_arrived'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    -- Notify the request creator
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
        req.organization_id,
        'delivery_arrived',
        'Доставка сегодня',
        'Заявка #' || req.request_number || ' должна прибыть в ТК сегодня',
        '/requests/' || req.id
      );
    END IF;

    -- Also notify all admins/editors in the organization
    INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
    SELECT 
      uo.user_id,
      req.organization_id,
      'delivery_arrived',
      'Доставка сегодня',
      'Заявка #' || req.request_number || ' должна прибыть в ТК сегодня',
      '/requests/' || req.id
    FROM public.user_organizations uo
    WHERE uo.organization_id = req.organization_id
      AND uo.role IN ('owner', 'admin', 'editor')
      AND uo.user_id != COALESCE(req.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
      -- Avoid duplicate notifications
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uo.user_id
          AND n.link = '/requests/' || req.id
          AND n.type = 'delivery_arrived'
          AND n.created_at::date = CURRENT_DATE
      );
  END LOOP;
END;
$function$;