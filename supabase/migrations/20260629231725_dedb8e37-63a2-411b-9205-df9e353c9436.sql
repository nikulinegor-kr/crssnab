
-- 1) request_shipments
CREATE TABLE public.request_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 0,
  transport_type text NOT NULL DEFAULT 'auto', -- auto | container | rail | air | sea
  transport_company text,
  vehicle_number text,
  trailer_number text,
  driver_name text,
  driver_phone text,
  waybill_number text,
  load_date date,
  planned_arrival_date date,
  actual_arrival_date date,
  status text NOT NULL DEFAULT 'Ожидает погрузки',
  comment text,
  document_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_shipments TO authenticated;
GRANT ALL ON public.request_shipments TO service_role;

ALTER TABLE public.request_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read shipments"
  ON public.request_shipments FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org editors insert shipments"
  ON public.request_shipments FOR INSERT TO authenticated
  WITH CHECK (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE POLICY "Org editors update shipments"
  ON public.request_shipments FOR UPDATE TO authenticated
  USING (public.user_can_edit_requests(auth.uid(), organization_id))
  WITH CHECK (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE POLICY "Org editors delete shipments"
  ON public.request_shipments FOR DELETE TO authenticated
  USING (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE INDEX idx_request_shipments_request ON public.request_shipments(request_id);
CREATE INDEX idx_request_shipments_org ON public.request_shipments(organization_id);
CREATE UNIQUE INDEX uniq_request_shipments_seq ON public.request_shipments(request_id, sequence_number);

CREATE TRIGGER trg_request_shipments_updated
  BEFORE UPDATE ON public.request_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto sequence_number per request
CREATE OR REPLACE FUNCTION public.assign_shipment_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sequence_number IS NULL OR NEW.sequence_number = 0 THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
      INTO NEW.sequence_number
      FROM public.request_shipments
      WHERE request_id = NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_request_shipments_seq
  BEFORE INSERT ON public.request_shipments
  FOR EACH ROW EXECUTE FUNCTION public.assign_shipment_sequence();

-- 2) shipment_items
CREATE TABLE public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  shipment_id uuid NOT NULL REFERENCES public.request_shipments(id) ON DELETE CASCADE,
  product_id uuid,
  material_name text NOT NULL,
  quantity numeric,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;
GRANT ALL ON public.shipment_items TO service_role;

ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read shipment items"
  ON public.shipment_items FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org editors insert shipment items"
  ON public.shipment_items FOR INSERT TO authenticated
  WITH CHECK (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE POLICY "Org editors update shipment items"
  ON public.shipment_items FOR UPDATE TO authenticated
  USING (public.user_can_edit_requests(auth.uid(), organization_id))
  WITH CHECK (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE POLICY "Org editors delete shipment items"
  ON public.shipment_items FOR DELETE TO authenticated
  USING (public.user_can_edit_requests(auth.uid(), organization_id));

CREATE INDEX idx_shipment_items_shipment ON public.shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_org ON public.shipment_items(organization_id);

CREATE TRIGGER trg_shipment_items_updated
  BEFORE UPDATE ON public.shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill: migrate single-shipment data from requests into first request_shipments row
INSERT INTO public.request_shipments (
  organization_id, request_id, sequence_number, transport_type,
  transport_company, vehicle_number, driver_name, driver_phone, waybill_number,
  load_date, planned_arrival_date, actual_arrival_date, status, comment
)
SELECT
  r.organization_id,
  r.id,
  1,
  'auto',
  r.transport_company,
  NULL,
  NULL,
  NULL,
  r.waybill_number,
  r.shipment_date::date,
  r.delivery_date::date,
  r.actual_arrival_date::date,
  CASE
    WHEN r.actual_arrival_date IS NOT NULL OR r.status IN ('Доставлено','Выполнено','Закрыто') THEN 'Завершена'
    WHEN r.status = 'Доставлено в ТК' THEN 'Прибыла'
    WHEN r.status = 'В пути' OR r.shipment_date IS NOT NULL THEN 'В пути'
    ELSE 'Ожидает погрузки'
  END,
  NULL
FROM public.requests r
WHERE r.organization_id IS NOT NULL
  AND (
    r.transport_company IS NOT NULL
    OR r.waybill_number IS NOT NULL
    OR r.shipment_date IS NOT NULL
    OR r.delivery_date IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.request_shipments s WHERE s.request_id = r.id
  );
