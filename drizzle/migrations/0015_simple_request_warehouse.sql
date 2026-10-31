CREATE OR REPLACE FUNCTION public.user_can_use_qr_warehouse(_user uuid, _org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.user_has_permission(_user,_org,'erp.warehouse') AND (EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id=_user AND organization_id=_org AND is_active AND role IN ('owner','admin')) OR NOT EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=_user AND organization_id=_org AND permission_key='erp' AND allowed=false)) $$;
ALTER TABLE public.warehouse_documents ADD COLUMN equipment_id uuid REFERENCES public.equipment(id);
ALTER TABLE public.warehouse_documents ADD COLUMN operation_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.warehouse_documents ADD COLUMN operation_key uuid;
CREATE UNIQUE INDEX warehouse_operation_key_idx ON public.warehouse_documents(organization_id,operation_key) WHERE operation_key IS NOT NULL;
ALTER TABLE public.warehouse_issues ADD COLUMN equipment_id uuid REFERENCES public.equipment(id);
ALTER TABLE public.warehouse_issues ADD COLUMN operation_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.warehouse_units ADD COLUMN request_item_id uuid REFERENCES public.request_items(id);
CREATE TABLE public.warehouse_request_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), request_id uuid NOT NULL UNIQUE REFERENCES public.requests(id), document_id uuid NOT NULL UNIQUE REFERENCES public.warehouse_documents(id), warehouse_id uuid NOT NULL REFERENCES public.warehouses(id), received_by uuid NOT NULL, receiver_name text NOT NULL, created_by uuid NOT NULL DEFAULT auth.uid(), received_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.warehouse_request_receipts TO authenticated;
GRANT ALL ON public.warehouse_request_receipts TO service_role;
ALTER TABLE public.warehouse_request_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY request_receipt_read ON public.warehouse_request_receipts FOR SELECT TO authenticated USING(public.user_can_use_qr_warehouse(auth.uid(),organization_id) AND EXISTS(SELECT 1 FROM public.requests r WHERE r.id=request_id));
CREATE OR REPLACE FUNCTION public.receive_warehouse_request(_request_id uuid,_warehouse_id uuid,_received_by uuid,_lines jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.requests; v_doc uuid; v_receipt public.warehouse_request_receipts; x jsonb; it public.request_items; v_uid uuid; v_qty numeric; v_kind text; n int; v_receiver text; v_actor uuid:=auth.uid();
BEGIN
 SELECT * INTO r FROM public.requests WHERE id=_request_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor,r.organization_id) OR NOT public.user_can_view_request(v_actor,r.organization_id,r.applicant_user_id) THEN RAISE EXCEPTION 'Нет доступа к приёмке заявки' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_receipt FROM public.warehouse_request_receipts WHERE request_id=r.id;
 IF v_receipt.id IS NOT NULL THEN
 IF v_receipt.warehouse_id IS DISTINCT FROM _warehouse_id OR v_receipt.received_by IS DISTINCT FROM _received_by THEN RAISE EXCEPTION 'Заявка уже принята с другими параметрами'; END IF;
 RETURN jsonb_build_object('id',v_receipt.id,'document_id',v_receipt.document_id,'already_received',true); END IF;
 IF r.status<>'Доставлено' THEN RAISE EXCEPTION 'Приёмка доступна только для заявки Доставлено'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=_warehouse_id AND organization_id=r.organization_id) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id=_received_by AND organization_id=r.organization_id AND is_active) THEN RAISE EXCEPTION 'Приёмщик не является действующим сотрудником' USING ERRCODE='42501'; END IF;
 SELECT full_name INTO v_receiver FROM public.profiles WHERE id=_received_by;
 IF _lines IS NULL OR jsonb_typeof(_lines)<>'array' OR jsonb_array_length(_lines)=0 THEN RAISE EXCEPTION 'В заявке нет позиций для приёмки'; END IF;
 IF (SELECT count(*) FROM public.request_items WHERE request_id=r.id AND quantity>0)<>jsonb_array_length(_lines) THEN RAISE EXCEPTION 'Проверьте позиции заявки'; END IF;
 IF (SELECT count(DISTINCT value->>'item_id') FROM jsonb_array_elements(_lines))<>jsonb_array_length(_lines) THEN RAISE EXCEPTION 'Позиции не должны повторяться'; END IF;
 INSERT INTO public.warehouse_documents(organization_id,doc_type,request_id,created_by,recipient_user_id) VALUES(r.organization_id,'receipt',r.id,v_actor,_received_by) RETURNING id INTO v_doc;
 FOR x IN SELECT value FROM jsonb_array_elements(_lines) LOOP
 SELECT * INTO it FROM public.request_items WHERE id=(x->>'item_id')::uuid AND request_id=r.id AND organization_id=r.organization_id FOR UPDATE;
 IF it.id IS NULL THEN RAISE EXCEPTION 'Позиция не принадлежит заявке'; END IF;
 v_qty:=(x->>'quantity')::numeric; v_kind:=x->>'kind';
 IF v_qty IS NULL OR v_qty<=0 OR v_qty>it.quantity THEN RAISE EXCEPTION 'Количество превышает доставленное или недопустимо'; END IF;
 IF v_qty<>it.quantity THEN RAISE EXCEPTION 'Для полной приёмки укажите доставленное количество'; END IF;
 IF v_kind IS NULL OR v_kind NOT IN ('item','batch') THEN RAISE EXCEPTION 'Выберите тип ТМЦ'; END IF;
 IF v_kind='item' AND (v_qty<>trunc(v_qty) OR v_qty>1000) THEN RAISE EXCEPTION 'Количество изделий должно быть целым, не более 1000'; END IF;
 FOR n IN 1..(CASE WHEN v_kind='item' THEN v_qty::int ELSE 1 END) LOOP
 INSERT INTO public.warehouse_units(organization_id,kind,name,unit,batch_number,serial_number,request_item_id,created_by) VALUES(r.organization_id,v_kind,it.name,COALESCE(NULLIF(btrim(x->>'unit'),''),'шт'),CASE WHEN v_kind='batch' THEN r.request_number END,CASE WHEN v_kind='item' THEN concat(r.request_number,' / ',left(it.id::text,8),' / ',n) END,it.id,v_actor) RETURNING id INTO v_uid;
 INSERT INTO public.warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES(r.organization_id,v_doc,v_uid,CASE WHEN v_kind='item' THEN 1 ELSE v_qty END,_warehouse_id);
 END LOOP; END LOOP;
 INSERT INTO public.warehouse_request_receipts(organization_id,request_id,document_id,warehouse_id,received_by,receiver_name,created_by) VALUES(r.organization_id,r.id,v_doc,_warehouse_id,_received_by,COALESCE(NULLIF(v_receiver,''),'—'),v_actor) RETURNING * INTO v_receipt;
 PERFORM public.post_warehouse_document(v_doc);
 RETURN jsonb_build_object('id',v_receipt.id,'document_id',v_doc,'already_received',false);
END $$;
REVOKE ALL ON FUNCTION public.receive_warehouse_request(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_warehouse_request(uuid,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.warehouse_request_receipt_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status='posted' AND OLD.status='draft' AND NEW.doc_type='receipt' AND NEW.request_id IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=NEW.request_id AND document_id=NEW.id) THEN RAISE EXCEPTION 'Осуществите приёмку из заявки'; END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER warehouse_request_receipt_guard BEFORE UPDATE ON public.warehouse_documents FOR EACH ROW EXECUTE FUNCTION public.warehouse_request_receipt_guard();
CREATE OR REPLACE FUNCTION public.simple_warehouse_operation(_operation_key uuid,_unit_id uuid,_type text,_from_warehouse_id uuid,_to_warehouse_id uuid,_quantity numeric,_recipient text,_operation_date date,_equipment_id uuid,_object_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.warehouse_units; b record; v_doc uuid; v_left numeric:=_quantity; v_part numeric; v_result jsonb; v_actor uuid:=auth.uid();
BEGIN
 SELECT * INTO u FROM public.warehouse_units WHERE id=_unit_id FOR UPDATE;
 IF u.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor,u.organization_id) THEN RAISE EXCEPTION 'Нет доступа к ТМЦ' USING ERRCODE='42501'; END IF;
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT id INTO v_doc FROM public.warehouse_documents WHERE organization_id=u.organization_id AND operation_key=_operation_key;
 IF v_doc IS NOT NULL THEN RETURN public.post_warehouse_document(v_doc); END IF;
 IF _type NOT IN ('move','issue') OR _type IS NULL THEN RAISE EXCEPTION 'Недопустимая операция'; END IF;
 IF _quantity IS NULL OR _quantity<=0 OR (u.kind='item' AND _quantity<>1) THEN RAISE EXCEPTION 'Недопустимое количество'; END IF;
 IF _type='move' AND (_to_warehouse_id IS NULL OR _to_warehouse_id=_from_warehouse_id) THEN RAISE EXCEPTION 'Выберите другой склад'; END IF;
 IF _type='issue' THEN
 IF COALESCE(btrim(_recipient),'')='' OR _operation_date IS NULL THEN RAISE EXCEPTION 'Укажите получателя и дату'; END IF;
 IF (_equipment_id IS NULL)=(_object_id IS NULL) THEN RAISE EXCEPTION 'Выберите технику либо объект'; END IF;
 IF _equipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.equipment WHERE id=_equipment_id AND organization_id=u.organization_id) THEN RAISE EXCEPTION 'Техника другой организации' USING ERRCODE='42501'; END IF;
 IF _object_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.request_objects WHERE id=_object_id AND organization_id=u.organization_id) THEN RAISE EXCEPTION 'Объект другой организации' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO public.warehouse_documents(organization_id,doc_type,recipient_name,object_id,equipment_id,operation_date,operation_key,created_by) VALUES(u.organization_id,_type,CASE WHEN _type='issue' THEN btrim(_recipient) END,_object_id,_equipment_id,_operation_date,_operation_key,v_actor) RETURNING id INTO v_doc;
 FOR b IN SELECT * FROM public.warehouse_balances WHERE unit_id=u.id AND warehouse_id=_from_warehouse_id AND organization_id=u.organization_id AND quantity>0 ORDER BY id FOR UPDATE LOOP
 EXIT WHEN v_left<=0; v_part:=least(v_left,b.quantity);
 INSERT INTO public.warehouse_document_lines(organization_id,document_id,unit_id,quantity,from_warehouse_id,from_cell_id,to_warehouse_id) VALUES(u.organization_id,v_doc,u.id,v_part,b.warehouse_id,b.cell_id,CASE WHEN _type='move' THEN _to_warehouse_id END);
 v_left:=v_left-v_part; END LOOP;
 IF v_left>0 THEN RAISE EXCEPTION 'Недостаточно остатка'; END IF;
 v_result:=public.post_warehouse_document(v_doc);
 UPDATE public.warehouse_issues SET equipment_id=_equipment_id, object_id=_object_id, operation_date=_operation_date WHERE document_id=v_doc;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.simple_warehouse_operation(uuid,uuid,text,uuid,uuid,numeric,text,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.simple_warehouse_operation(uuid,uuid,text,uuid,uuid,numeric,text,date,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.post_warehouse_document(_document_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d warehouse_documents; l record; u warehouse_units; i warehouse_issues; v_actor uuid := auth.uid(); v_total numeric; v_seq int; v_count int := 0;
BEGIN
 SELECT * INTO d FROM warehouse_documents WHERE id = _document_id FOR UPDATE;
 IF d.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, d.organization_id) THEN RAISE EXCEPTION 'Нет доступа к документу' USING ERRCODE = '42501'; END IF;
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
CREATE OR REPLACE FUNCTION public.warehouse_source_item_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_request uuid; BEGIN FOR v_request IN SELECT DISTINCT id FROM (VALUES (CASE WHEN TG_OP<>'INSERT' THEN OLD.request_id END),(CASE WHEN TG_OP<>'DELETE' THEN NEW.request_id END)) q(id) WHERE id IS NOT NULL ORDER BY id LOOP PERFORM 1 FROM public.requests WHERE id=v_request FOR UPDATE; IF EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=v_request) THEN RAISE EXCEPTION 'Позиции принятой на склад заявки нельзя изменять'; END IF; END LOOP; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER warehouse_source_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.request_items FOR EACH ROW EXECUTE FUNCTION public.warehouse_source_item_guard();
CREATE OR REPLACE FUNCTION public.warehouse_line_draft_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.warehouse_documents; v_doc uuid; BEGIN FOR v_doc IN SELECT DISTINCT id FROM (VALUES(CASE WHEN TG_OP<>'INSERT' THEN OLD.document_id END),(CASE WHEN TG_OP<>'DELETE' THEN NEW.document_id END)) q(id) WHERE id IS NOT NULL ORDER BY id LOOP SELECT * INTO d FROM public.warehouse_documents WHERE id=v_doc FOR UPDATE; IF d.status<>'draft' THEN RAISE EXCEPTION 'Операция уже подтверждена'; END IF; END LOOP; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER warehouse_line_draft_guard BEFORE INSERT OR UPDATE OR DELETE ON public.warehouse_document_lines FOR EACH ROW EXECUTE FUNCTION public.warehouse_line_draft_guard();
CREATE OR REPLACE FUNCTION public.handle_request_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.product_id IS NULL OR NEW.warehouse_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.reserve_on_warehouse IS DISTINCT FROM NEW.reserve_on_warehouse THEN
 INSERT INTO public.stock_movements(organization_id,product_id,warehouse_id,type,quantity,request_id,comment,created_by) VALUES(NEW.organization_id,NEW.product_id,NEW.warehouse_id,CASE WHEN NEW.reserve_on_warehouse THEN 'RESERVE' ELSE 'UNRESERVE' END,COALESCE(NEW.quantity,1),NEW.id,'Изменение резерва по заявке #'||NEW.request_number,auth.uid()); END IF;
 IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 IF NEW.status='В пути' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'В пути') THEN INSERT INTO public.stock_movements(organization_id,product_id,warehouse_id,type,quantity,request_id,comment,created_by) VALUES(NEW.organization_id,NEW.product_id,NEW.warehouse_id,'IN_TRANSIT',COALESCE(NEW.quantity,1),NEW.id,'Товар в пути по заявке #'||NEW.request_number,NEW.created_by); END IF;
 -- Delivered is not a receipt. Explicit warehouse receipt is required; existing movements remain untouched.
 RETURN NEW; END $$;