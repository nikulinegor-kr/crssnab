-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION sync_request_to_calendar()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Создаем или обновляем событие для даты отгрузки
  IF NEW.shipment_date IS NOT NULL THEN
    INSERT INTO calendar_events (
      title,
      description,
      start_date,
      all_day,
      organization_id,
      event_type,
      priority,
      color
    ) VALUES (
      'Отгрузка: ' || NEW.request_number,
      NEW.description,
      NEW.shipment_date,
      true,
      NEW.organization_id,
      'shipment',
      COALESCE(NEW.priority, 'Средний'),
      '#3b82f6'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Создаем или обновляем событие для даты доставки
  IF NEW.delivery_date IS NOT NULL THEN
    INSERT INTO calendar_events (
      title,
      description,
      start_date,
      all_day,
      organization_id,
      event_type,
      priority,
      color
    ) VALUES (
      'Доставка: ' || NEW.request_number,
      NEW.description,
      NEW.delivery_date,
      true,
      NEW.organization_id,
      'delivery',
      COALESCE(NEW.priority, 'Средний'),
      '#10b981'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;