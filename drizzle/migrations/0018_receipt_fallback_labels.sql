ALTER TABLE public.warehouse_units ADD COLUMN source_request_id uuid REFERENCES public.requests(id);
ALTER TABLE public.warehouse_units ADD COLUMN request_title text;
ALTER TABLE public.warehouse_units ADD COLUMN request_number text;
ALTER TABLE public.warehouse_request_receipts ADD COLUMN confirmed_lines jsonb;
CREATE OR REPLACE FUNCTION public.receive_warehouse_request(_request_id uuid,_warehouse_id uuid,_received_by uuid,_lines jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.requests; v_doc uuid; v_receipt public.warehouse_request_receipts; x jsonb; it public.request_items; v_uid uuid; v_qty numeric; v_kind text; n int; v_receiver text; v_actor uuid:=auth.uid(); v_fallback boolean; v_name text; v_unit text;
BEGIN
 SELECT * INTO r FROM public.requests WHERE id=_request_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor,r.organization_id) OR NOT public.user_can_view_request(v_actor,r.organization_id,r.applicant_user_id) THEN RAISE EXCEPTION 'Нет доступа к приёмке заявки' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_receipt FROM public.warehouse_request_receipts WHERE request_id=r.id;
 IF v_receipt.id IS NOT NULL THEN
 IF v_receipt.warehouse_id IS DISTINCT FROM _warehouse_id OR v_receipt.received_by IS DISTINCT FROM _received_by THEN RAISE EXCEPTION 'Заявка уже принята с другими параметрами'; END IF;
 IF v_receipt.confirmed_lines IS NOT NULL AND v_receipt.confirmed_lines IS DISTINCT FROM _lines THEN RAISE EXCEPTION 'Заявка уже принята с другими параметрами'; END IF;
 RETURN jsonb_build_object('id',v_receipt.id,'document_id',v_receipt.document_id,'already_received',true); END IF;
 IF r.status<>'Доставлено' THEN RAISE EXCEPTION 'Приёмка доступна только для заявки Доставлено'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=_warehouse_id AND organization_id=r.organization_id) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id=_received_by AND organization_id=r.organization_id AND is_active) THEN RAISE EXCEPTION 'Приёмщик не является действующим сотрудником' USING ERRCODE='42501'; END IF;
 SELECT full_name INTO v_receiver FROM public.profiles WHERE id=_received_by;
 IF _lines IS NULL OR jsonb_typeof(_lines)<>'array' OR jsonb_array_length(_lines)=0 THEN RAISE EXCEPTION 'В заявке нет позиций для приёмки'; END IF;
 v_fallback:=NOT EXISTS(SELECT 1 FROM public.request_items WHERE request_id=r.id);
 IF v_fallback THEN
 IF jsonb_array_length(_lines)<>1 OR (_lines->0->>'item_id') IS NOT NULL THEN RAISE EXCEPTION 'Без позиций подтвердите одну строку заявки'; END IF;
 IF NULLIF(btrim(r.description),'') IS NULL THEN RAISE EXCEPTION 'Укажите название заявки'; END IF;
 ELSE
 IF (SELECT count(*) FROM public.request_items WHERE request_id=r.id)<>jsonb_array_length(_lines) THEN RAISE EXCEPTION 'Проверьте позиции заявки'; END IF;
 IF (SELECT count(DISTINCT value->>'item_id') FROM jsonb_array_elements(_lines))<>jsonb_array_length(_lines) THEN RAISE EXCEPTION 'Позиции не должны повторяться'; END IF;
 END IF;
 INSERT INTO public.warehouse_documents(organization_id,doc_type,request_id,created_by,recipient_user_id) VALUES(r.organization_id,'receipt',r.id,v_actor,_received_by) RETURNING id INTO v_doc;
 FOR x IN SELECT value FROM jsonb_array_elements(_lines) LOOP
 v_qty:=(x->>'quantity')::numeric; v_kind:=x->>'kind'; v_unit:=NULLIF(btrim(x->>'unit'),'');
 IF v_qty IS NULL OR v_qty<=0 OR v_qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Укажите допустимое количество больше нуля'; END IF;
 IF v_unit IS NULL OR length(v_unit)>40 THEN RAISE EXCEPTION 'Укажите единицу измерения'; END IF;
 IF v_fallback THEN v_name:=btrim(r.description);
 ELSE
 SELECT * INTO it FROM public.request_items WHERE id=(x->>'item_id')::uuid AND request_id=r.id AND organization_id=r.organization_id FOR UPDATE;
 IF it.id IS NULL THEN RAISE EXCEPTION 'Позиция не принадлежит заявке'; END IF;
 IF v_qty>it.quantity THEN RAISE EXCEPTION 'Количество превышает доставленное'; END IF;
 IF v_qty<>it.quantity THEN RAISE EXCEPTION 'Для полной приёмки укажите доставленное количество'; END IF;
 v_name:=it.name;
 END IF;
 IF v_kind IS NULL OR v_kind NOT IN ('item','batch') THEN RAISE EXCEPTION 'Выберите тип ТМЦ'; END IF;
 IF v_kind='item' AND (v_qty<>trunc(v_qty) OR v_qty>1000) THEN RAISE EXCEPTION 'Количество изделий должно быть целым, не более 1000'; END IF;
 FOR n IN 1..(CASE WHEN v_kind='item' THEN v_qty::int ELSE 1 END) LOOP
 INSERT INTO public.warehouse_units(organization_id,kind,name,unit,batch_number,serial_number,request_item_id,source_request_id,request_title,request_number,created_by) VALUES(r.organization_id,v_kind,v_name,v_unit,CASE WHEN v_kind='batch' THEN r.request_number END,CASE WHEN v_kind='item' THEN concat(r.request_number,' / ',left(COALESCE(it.id,r.id)::text,8),' / ',n) END,it.id,r.id,btrim(r.description),r.request_number,v_actor) RETURNING id INTO v_uid;
 INSERT INTO public.warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES(r.organization_id,v_doc,v_uid,CASE WHEN v_kind='item' THEN 1 ELSE v_qty END,_warehouse_id);
 END LOOP; END LOOP;
 INSERT INTO public.warehouse_request_receipts(organization_id,request_id,document_id,warehouse_id,received_by,receiver_name,created_by,confirmed_lines) VALUES(r.organization_id,r.id,v_doc,_warehouse_id,_received_by,COALESCE(NULLIF(v_receiver,''),'—'),v_actor,_lines) RETURNING * INTO v_receipt;
 PERFORM public.post_warehouse_document(v_doc);
 RETURN jsonb_build_object('id',v_receipt.id,'document_id',v_doc,'already_received',false);
END $$;
REVOKE ALL ON FUNCTION public.receive_warehouse_request(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_warehouse_request(uuid,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.warehouse_request_receipt_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='posted' AND OLD.status='draft' AND NEW.doc_type='receipt' THEN
 IF NEW.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=NEW.request_id AND document_id=NEW.id) THEN RAISE EXCEPTION 'Осуществите приёмку из заявки'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_document_lines l JOIN public.warehouse_units u ON u.id=l.unit_id WHERE l.document_id=NEW.id AND (u.source_request_id IS NOT NULL OR u.request_item_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts r WHERE r.document_id=NEW.id AND (r.request_id=u.source_request_id OR EXISTS(SELECT 1 FROM public.request_items it WHERE it.id=u.request_item_id AND it.request_id=r.request_id)))) THEN RAISE EXCEPTION 'Повторная приёмка ТМЦ заявки запрещена'; END IF;
 END IF; RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.warehouse_request_receipt_guard() FROM PUBLIC,anon,authenticated;