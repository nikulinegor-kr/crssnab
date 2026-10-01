-- Narrow request triggers so saving unrelated fields does not fire heavy handlers.
DROP TRIGGER IF EXISTS trg_requests_notify_event ON public.requests;
CREATE TRIGGER trg_requests_notify_event
  AFTER INSERT OR UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_request_event();

DROP TRIGGER IF EXISTS trg_request_stock_movement ON public.requests;
CREATE TRIGGER trg_request_stock_movement
  AFTER INSERT OR UPDATE OF status, reserve_on_warehouse ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_stock_movement();

DROP TRIGGER IF EXISTS trg_set_actual_arrival ON public.requests;
CREATE TRIGGER trg_set_actual_arrival
  BEFORE UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_actual_arrival_date();

DROP TRIGGER IF EXISTS trg_set_payment_date ON public.requests;
CREATE TRIGGER trg_set_payment_date
  BEFORE INSERT OR UPDATE OF payment_percentage, payment_status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_date();

-- Keep the audit log trigger, but only for the fields it actually records.
DROP TRIGGER IF EXISTS trigger_log_request_activity ON public.requests;
CREATE TRIGGER trigger_log_request_activity
  AFTER INSERT OR UPDATE OF status, priority, executor, amount, payment_status,
    payment_percentage, shipment_date, delivery_date, contractor, invoice_number,
    transport_company, description, object_id, applicant, received_by
  ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.log_request_activity();

-- Speed up notification queue sweeps used by the background worker.
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created
  ON public.notification_queue (status, created_at);
