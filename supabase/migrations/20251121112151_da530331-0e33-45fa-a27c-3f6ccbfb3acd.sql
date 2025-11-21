-- Add request_id to calendar_events to link events with requests
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES requests(id) ON DELETE CASCADE;

-- Update sync function to store request_id
CREATE OR REPLACE FUNCTION sync_request_to_calendar()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete old events for this request if dates changed
  IF (TG_OP = 'UPDATE') THEN
    DELETE FROM calendar_events 
    WHERE request_id = NEW.id 
    AND event_type IN ('shipment', 'delivery');
  END IF;

  -- Создаем событие для даты отгрузки
  IF NEW.shipment_date IS NOT NULL THEN
    INSERT INTO calendar_events (
      title,
      description,
      start_date,
      all_day,
      organization_id,
      event_type,
      priority,
      color,
      request_id
    ) VALUES (
      'Отгрузка: ' || NEW.request_number,
      NEW.description,
      NEW.shipment_date,
      true,
      NEW.organization_id,
      'shipment',
      COALESCE(NEW.priority, 'Средний'),
      '#3b82f6',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Создаем событие для даты доставки
  IF NEW.delivery_date IS NOT NULL THEN
    INSERT INTO calendar_events (
      title,
      description,
      start_date,
      all_day,
      organization_id,
      event_type,
      priority,
      color,
      request_id
    ) VALUES (
      'Доставка: ' || NEW.request_number,
      NEW.description,
      NEW.delivery_date,
      true,
      NEW.organization_id,
      'delivery',
      COALESCE(NEW.priority, 'Средний'),
      '#10b981',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create function to send notifications for upcoming events (1 day before)
CREATE OR REPLACE FUNCTION check_upcoming_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Find events that are 1 day away and haven't been notified yet
  FOR event_record IN
    SELECT ce.*, p.id as user_id, p.full_name, p.email
    FROM calendar_events ce
    LEFT JOIN profiles p ON ce.assignee_id = p.id
    WHERE ce.start_date::date = (CURRENT_DATE + INTERVAL '1 day')::date
    AND ce.assignee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.link = '/calendar'
      AND n.user_id = ce.assignee_id
      AND n.message LIKE '%' || ce.title || '%'
      AND n.created_at::date = CURRENT_DATE
    )
  LOOP
    -- Create notification for assignee
    INSERT INTO notifications (
      user_id,
      organization_id,
      type,
      title,
      message,
      link
    ) VALUES (
      event_record.user_id,
      event_record.organization_id,
      'event_reminder',
      'Напоминание о событии',
      'Завтра: ' || event_record.title,
      '/calendar'
    );
  END LOOP;
END;
$$;