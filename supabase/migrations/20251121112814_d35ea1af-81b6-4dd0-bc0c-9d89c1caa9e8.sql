-- Update sync function to map priorities correctly
CREATE OR REPLACE FUNCTION sync_request_to_calendar()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_priority text;
BEGIN
  -- Map request priority to calendar priority
  mapped_priority := CASE 
    WHEN NEW.priority = 'Аварийно' THEN 'Высокий'
    WHEN NEW.priority = 'Срочно' THEN 'Высокий'
    WHEN NEW.priority = 'Планово' THEN 'Средний'
    ELSE 'Средний'
  END;

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
      mapped_priority,
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
      mapped_priority,
      '#10b981',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;