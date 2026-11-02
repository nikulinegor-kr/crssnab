COMMENT ON FUNCTION public.warehouse_issue(uuid,uuid,uuid,numeric,text,uuid,date,uuid,uuid,text) IS 'Выдача ТМЦ: получатель — сотрудник из списка, объект или техника; имя можно указать вручную без учётной записи';

CREATE OR REPLACE FUNCTION public.warehouse_issue(_operation_key uuid, _unit_id uuid, _from_warehouse_id uuid, _quantity numeric, _recipient text, _recipient_user_id uuid, _operation_date date, _equipment_id uuid, _object_id uuid, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u public.warehouse_units; b record; v_doc uuid; v_left numeric := _quantity; v_part numeric; v_result jsonb; v_actor uuid := auth.uid();
BEGIN
 SELECT * INTO u FROM public.warehouse_units WHERE id = _unit_id FOR UPDATE;
 IF u.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, u.organization_id) THEN RAISE EXCEPTION 'Нет доступа к ТМЦ' USING ERRCODE='42501'; END IF;
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT id INTO v_doc FROM public.warehouse_documents WHERE organization_id = u.organization_id AND operation_key = _operation_key;
 IF v_doc IS NOT NULL THEN RETURN public.post_warehouse_document(v_doc); END IF;
 IF _quantity IS NULL OR _quantity <= 0 OR _quantity::text IN ('NaN','Infinity') OR (u.kind = 'item' AND _quantity <> 1) THEN RAISE EXCEPTION 'Недопустимое количество'; END IF;
 IF COALESCE(btrim(_recipient),'') = '' OR _operation_date IS NULL THEN RAISE EXCEPTION 'Укажите получателя и дату'; END IF;
 IF _equipment_id IS NOT NULL AND _object_id IS NOT NULL THEN RAISE EXCEPTION 'Выберите технику либо объект'; END IF;
 IF _recipient_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id = _recipient_user_id AND organization_id = u.organization_id AND is_active) THEN RAISE EXCEPTION 'Получатель не является сотрудником организации' USING ERRCODE='42501'; END IF;
 IF _equipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.equipment WHERE id = _equipment_id AND organization_id = u.organization_id) THEN RAISE EXCEPTION 'Техника другой организации' USING ERRCODE='42501'; END IF;
 IF _object_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.request_objects WHERE id = _object_id AND organization_id = u.organization_id) THEN RAISE EXCEPTION 'Объект другой организации' USING ERRCODE='42501'; END IF;
 INSERT INTO public.warehouse_documents(organization_id, doc_type, recipient_name, recipient_user_id, object_id, equipment_id, operation_date, operation_key, created_by, comment)
  VALUES (u.organization_id, 'issue', btrim(_recipient), _recipient_user_id, _object_id, _equipment_id, _operation_date, _operation_key, v_actor, NULLIF(btrim(_note),'')) RETURNING id INTO v_doc;
 FOR b IN SELECT * FROM public.warehouse_balances WHERE unit_id = u.id AND warehouse_id = _from_warehouse_id AND organization_id = u.organization_id AND quantity > 0 ORDER BY id FOR UPDATE LOOP
  EXIT WHEN v_left <= 0; v_part := least(v_left, b.quantity);
  INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, from_warehouse_id, from_cell_id) VALUES (u.organization_id, v_doc, u.id, v_part, b.warehouse_id, b.cell_id);
  v_left := v_left - v_part;
 END LOOP;
 IF v_left > 0 THEN RAISE EXCEPTION 'Недостаточно остатка'; END IF;
 v_result := public.post_warehouse_document(v_doc);
 UPDATE public.warehouse_issues SET note = NULLIF(btrim(_note),'') WHERE document_id = v_doc;
 RETURN v_result;
END
$function$;