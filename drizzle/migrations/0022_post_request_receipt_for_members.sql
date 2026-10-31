CREATE OR REPLACE FUNCTION public.post_warehouse_document(_document_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d warehouse_documents; l record; u warehouse_units; i warehouse_issues; v_actor uuid := auth.uid(); v_total numeric; v_seq int; v_count int := 0;
BEGIN
 SELECT * INTO d FROM warehouse_documents WHERE id = _document_id FOR UPDATE;
 IF d.id IS NULL OR NOT (public.user_can_use_qr_warehouse(v_actor, d.organization_id) OR (d.doc_type = 'receipt' AND public.user_has_org_access(v_actor, d.organization_id) AND EXISTS(SELECT 1 FROM public.warehouse_request_receipts rr WHERE rr.document_id = d.id))) THEN RAISE EXCEPTION 'Нет доступа к документу' USING ERRCODE = '42501'; END IF;
 IF d.status = 'posted' THEN RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', true); END IF;
 IF d.doc_type = 'issue' AND (COALESCE(btrim(d.recipient_name), '') = '' OR (d.request_id IS NULL AND d.object_id IS NULL AND d.equipment_id IS NULL)) THEN RAISE EXCEPTION 'Для выдачи укажите получателя и заявку, технику или объект'; END IF;
 IF d.request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM requests WHERE id = d.request_id AND organization_id = d.organization_id) THEN RAISE EXCEPTION 'Заявка другой организации' USING ERRCODE = '42501'; END IF;
 IF d.object_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_objects WHERE id = d.object_id AND organization_id = d.organization_id) THEN RAISE EXCEPTION 'Объект другой организации' USING ERRCODE = '42501'; END IF;
 IF d.equipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM equipment WHERE id=d.equipment_id AND organization_id=d.organization_id) THEN RAISE EXCEPTION 'Техника другой организации' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM warehouse_units WHERE id IN (SELECT unit_id FROM warehouse_document_lines WHERE document_id = d.id) ORDER BY id FOR UPDATE;
 FOR l IN SELECT * FROM warehouse_document_lines WHERE document_id = d.id ORDER BY unit_id, created_at, id LOOP
 v_count := v_count + 1;
 SELECT * INTO u FROM warehouse_units WHERE id = l.unit_id;
 IF u.organization_id <> d.organization_id OR l.organization_id <> d.organization_id THEN RAISE EXCEPTION 'Позиция другой организации' USING ERRCODE = '42501'; END IF;
 IF u.kind = 'item' AND l.quantity <> 1 THEN RAISE EXCEPTION 'Изделие «%» учитывается поштучно: количество 1', u.name; END IF;
 IF d.doc_type = 'receipt' THEN
 IF u.kind = 'item' THEN SELECT COALESCE(sum(quantity), 0) INTO v_total FROM warehouse_balances WHERE unit_id = u.id;
 IF v_total > 0 OR EXISTS (SELECT 1 FROM warehouse_issues WHERE unit_id = u.id AND returned_qty < issued_qty) THEN RAISE EXCEPTION 'Изделие «%» уже числится на складе или выдано', u.name; END IF; END IF;
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.to_warehouse_id, l.to_cell_id, l.quantity, 'receipt', v_actor);
 ELSIF d.doc_type = 'move' THEN
 IF l.from_warehouse_id = l.to_warehouse_id AND l.from_cell_id IS NOT DISTINCT FROM l.to_cell_id THEN RAISE EXCEPTION 'Место отправления и назначения совпадают'; END IF;
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.from_warehouse_id, l.from_cell_id, -l.quantity, 'move_out', v_actor);
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.to_warehouse_id, l.to_cell_id, l.quantity, 'move_in', v_actor);
 ELSIF d.doc_type = 'issue' THEN
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.from_warehouse_id, l.from_cell_id, -l.quantity, 'issue', v_actor);
 INSERT INTO warehouse_issues(organization_id, document_id, unit_id, warehouse_id, cell_id, recipient_name, recipient_user_id, request_id, object_id, equipment_id, operation_date, issued_qty) VALUES (d.organization_id, d.id, u.id, l.from_warehouse_id, l.from_cell_id, btrim(d.recipient_name), d.recipient_user_id, d.request_id, d.object_id,d.equipment_id,d.operation_date,l.quantity);
 ELSE
 SELECT * INTO i FROM warehouse_issues WHERE id = l.issue_id FOR UPDATE;
 IF i.id IS NULL OR i.organization_id <> d.organization_id OR i.unit_id <> u.id THEN RAISE EXCEPTION 'Возврат должен ссылаться на выдачу этой позиции'; END IF;
 IF i.returned_qty + l.quantity > i.issued_qty THEN RAISE EXCEPTION 'Возврат больше выданного: выдано %, уже возвращено %', i.issued_qty, i.returned_qty; END IF;
 UPDATE warehouse_issues SET returned_qty = returned_qty + l.quantity WHERE id = i.id;
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, COALESCE(l.to_warehouse_id, i.warehouse_id), CASE WHEN l.to_warehouse_id IS NULL THEN i.cell_id ELSE l.to_cell_id END, l.quantity, 'return', v_actor);
 END IF; END LOOP;
 IF v_count = 0 THEN RAISE EXCEPTION 'В документе нет позиций'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('warehouse_doc_number:' || d.organization_id::text, 0));
 SELECT COALESCE(max(split_part(number, '-', 3)::int), 0) + 1 INTO v_seq FROM warehouse_documents WHERE organization_id = d.organization_id AND number LIKE 'СК-' || to_char(now(), 'YYYY') || '-%';
 UPDATE warehouse_documents SET status = 'posted', posted_at = now(), posted_by = v_actor, number = 'СК-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0') WHERE id = d.id RETURNING * INTO d;
 RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', false);
END $$;
REVOKE EXECUTE ON FUNCTION public.post_warehouse_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_warehouse_document(uuid) TO authenticated, service_role;