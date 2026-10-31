CREATE OR REPLACE FUNCTION public.confirm_request_qr_logistics(_request_id uuid, _organization_id uuid, _action text, _carrier text DEFAULT NULL, _shipment_date date DEFAULT NULL, _planned_arrival date DEFAULT NULL, _actual_arrival date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.requests; actor uuid:=auth.uid(); carrier text:=nullif(btrim(_carrier),'');
BEGIN
 SELECT * INTO r FROM public.requests WHERE id=_request_id AND organization_id=_organization_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.user_has_org_access(actor,r.organization_id) OR NOT public.user_can_view_request(actor,r.organization_id,r.applicant_user_id) OR NOT public.user_can_edit_requests(actor,r.organization_id) THEN RAISE EXCEPTION 'Нет доступа к изменению логистики заявки' USING ERRCODE='42501'; END IF;
 IF _action='ship' THEN
  IF carrier IS NULL OR _shipment_date IS NULL OR _planned_arrival IS NULL THEN RAISE EXCEPTION 'Укажите ТК, дату отгрузки и плановую дату прихода'; END IF;
  IF NOT isfinite(_shipment_date) OR NOT isfinite(_planned_arrival) OR extract(year FROM _shipment_date) NOT BETWEEN 2000 AND 2100 OR extract(year FROM _planned_arrival) NOT BETWEEN 2000 AND 2100 OR _planned_arrival<_shipment_date THEN RAISE EXCEPTION 'Проверьте даты: приход не раньше отгрузки, год 2000–2100'; END IF;
  IF r.status='В пути' AND r.transport_company IS NOT DISTINCT FROM carrier AND r.shipment_date IS NOT DISTINCT FROM _shipment_date AND r.planned_delivery_date IS NOT DISTINCT FROM _planned_arrival THEN RETURN jsonb_build_object('request',to_jsonb(r),'already_confirmed',true); END IF;
  IF r.status<>'Готов к отгрузке' THEN RAISE EXCEPTION 'Отгрузка доступна только в статусе Готов к отгрузке; обновите заявку'; END IF;
  IF r.actual_arrival_date IS NOT NULL OR EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=r.id) THEN RAISE EXCEPTION 'Заявка уже доставлена или принята'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.requests source WHERE source.organization_id=r.organization_id AND btrim(source.transport_company)=carrier AND public.user_can_view_request(actor,source.organization_id,source.applicant_user_id)) THEN RAISE EXCEPTION 'Выберите ТК из существующего справочника организации'; END IF;
  UPDATE public.requests SET transport_company=carrier,shipment_date=_shipment_date,planned_delivery_date=_planned_arrival,delivery_date=_planned_arrival,status='В пути' WHERE id=r.id RETURNING * INTO r;
 ELSIF _action='deliver' THEN
  IF _actual_arrival IS NULL OR r.shipment_date IS NULL THEN RAISE EXCEPTION 'Укажите фактическую дату прихода и дату отгрузки'; END IF;
  IF NOT isfinite(_actual_arrival) OR extract(year FROM _actual_arrival) NOT BETWEEN 2000 AND 2100 OR _actual_arrival<r.shipment_date OR _actual_arrival>current_date THEN RAISE EXCEPTION 'Фактический приход не раньше отгрузки и не позже сегодняшнего дня'; END IF;
  IF r.status='Доставлено' AND (r.actual_arrival_date AT TIME ZONE 'UTC')::date=_actual_arrival THEN RETURN jsonb_build_object('request',to_jsonb(r),'already_confirmed',true); END IF;
  IF r.status<>'В пути' THEN RAISE EXCEPTION 'Подтверждение доставки доступно только в статусе В пути; обновите заявку'; END IF;
  UPDATE public.requests SET delivery_date=_actual_arrival,actual_arrival_date=(_actual_arrival::timestamp AT TIME ZONE 'UTC'),status='Доставлено' WHERE id=r.id RETURNING * INTO r;
 ELSE RAISE EXCEPTION 'Неизвестное действие'; END IF;
 RETURN jsonb_build_object('request',to_jsonb(r),'already_confirmed',false);
END $$;
REVOKE ALL ON FUNCTION public.confirm_request_qr_logistics(uuid,uuid,text,text,date,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_request_qr_logistics(uuid,uuid,text,text,date,date,date) TO authenticated,service_role;
COMMENT ON FUNCTION public.confirm_request_qr_logistics(uuid,uuid,text,text,date,date,date) IS 'Explicit QR shipment/delivery confirmation; locks the existing request, preserves permissions and notifications, never receives stock. delivery_date remains the existing logistics ETA until actual delivery; planned_delivery_date preserves the forecast.';