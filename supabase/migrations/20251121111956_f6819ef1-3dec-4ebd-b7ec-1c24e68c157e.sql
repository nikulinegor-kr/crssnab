-- Create function to sync request dates to calendar
CREATE OR REPLACE FUNCTION sync_request_to_calendar()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to sync requests to calendar
DROP TRIGGER IF EXISTS sync_request_dates_trigger ON requests;
CREATE TRIGGER sync_request_dates_trigger
  AFTER INSERT OR UPDATE OF shipment_date, delivery_date, request_number, description, priority
  ON requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_request_to_calendar();

-- Add unique constraint to prevent duplicate events
CREATE UNIQUE INDEX IF NOT EXISTS unique_request_calendar_event 
  ON calendar_events (organization_id, event_type, title) 
  WHERE event_type IN ('shipment', 'delivery');