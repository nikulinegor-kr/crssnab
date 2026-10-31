CREATE OR REPLACE FUNCTION public.manual_warehouse_receipt(_operation_key uuid,_warehouse_id uuid,_name text,_kind text,_quantity numeric,_unit text,_code text,_comment text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.warehouses; v_doc uuid; v_uid uuid; n int; v_actor uuid:=auth.uid(); v_name text:=NULLIF(btrim(_name),''); v_unit text:=NULLIF(btrim(_unit),''); v_code text:=NULLIF(btrim(_code),'');
BEGIN
 SELECT * INTO w FROM public.warehouses WHERE id=_warehouse_id;
 IF w.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor,w.organization_id) THEN RAISE EXCEPTION 'Нет доступа к складу' USING ERRCODE='42501'; END IF;
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Нет ключа операции'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_operation_key::text));
 SELECT id INTO v_doc FROM public.warehouse_documents WHERE operation_key=_operation_key AND organization_id=w.organization_id;
 IF v_doc IS NOT NULL THEN RETURN jsonb_build_object('document_id',v_doc,'already',true); END IF;
 IF v_name IS NULL OR length(v_name)>300 THEN RAISE EXCEPTION 'Укажите название ТМЦ'; END IF;
 IF v_unit IS NULL OR length(v_unit)>40 THEN RAISE EXCEPTION 'Укажите единицу измерения'; END IF;
 IF _kind NOT IN ('item','batch') THEN RAISE EXCEPTION 'Выберите тип ТМЦ'; END IF;
 IF _quantity IS NULL OR _quantity<=0 OR _quantity::text IN ('NaN','Infinity') THEN RAISE EXCEPTION 'Укажите количество больше нуля'; END IF;
 IF _kind='item' AND (_quantity<>trunc(_quantity) OR _quantity>1000) THEN RAISE EXCEPTION 'Количество изделий должно быть целым, не более 1000'; END IF;
 INSERT INTO public.warehouse_documents(organization_id,doc_type,created_by,comment,operation_key,operation_date) VALUES(w.organization_id,'receipt',v_actor,COALESCE(NULLIF(btrim(_comment),''),'Ручное оприходование'),_operation_key,current_date) RETURNING id INTO v_doc;
 FOR n IN 1..(CASE WHEN _kind='item' THEN _quantity::int ELSE 1 END) LOOP
  INSERT INTO public.warehouse_units(organization_id,kind,name,unit,batch_number,serial_number,created_by) VALUES(w.organization_id,_kind,v_name,v_unit,CASE WHEN _kind='batch' THEN v_code END,CASE WHEN _kind='item' THEN CASE WHEN _quantity=1 THEN v_code ELSE concat_ws(' / ',v_code,n) END END,v_actor) RETURNING id INTO v_uid;
  INSERT INTO public.warehouse_document_lines(organization_id,document_id,unit_id,quantity,to_warehouse_id) VALUES(w.organization_id,v_doc,v_uid,CASE WHEN _kind='item' THEN 1 ELSE _quantity END,_warehouse_id);
 END LOOP;
 PERFORM public.post_warehouse_document(v_doc);
 RETURN jsonb_build_object('document_id',v_doc,'already',false);
END $$;
REVOKE ALL ON FUNCTION public.manual_warehouse_receipt(uuid,uuid,text,text,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manual_warehouse_receipt(uuid,uuid,text,text,numeric,text,text,text) TO authenticated;