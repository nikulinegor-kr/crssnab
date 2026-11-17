CREATE OR REPLACE FUNCTION public.hard_delete_requests(_ids uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid[]; it uuid[]; u uuid[]; d uuid[]; i uuid[]; l uuid[]; b uuid[]; n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Требуется вход'; END IF;
  SELECT array_agg(id) INTO r FROM (SELECT id FROM public.requests WHERE id = ANY(_ids) ORDER BY id FOR UPDATE) s;
  IF r IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.requests q WHERE q.id = ANY(r) AND NOT public.user_can_edit_requests(auth.uid(), q.organization_id)) THEN
    RAISE EXCEPTION 'Недостаточно прав для удаления заявок';
  END IF;
  PERFORM set_config('crss.hard_delete', 'on', true);
  SELECT coalesce(array_agg(id),'{}') INTO it FROM public.request_items WHERE request_id = ANY(r);
  SELECT coalesce(array_agg(id),'{}') INTO u FROM public.warehouse_units WHERE source_request_id = ANY(r) OR request_item_id = ANY(it);
  SELECT coalesce(array_agg(id),'{}') INTO d FROM public.warehouse_documents x WHERE x.request_id = ANY(r)
    OR (EXISTS (SELECT 1 FROM public.warehouse_document_lines y WHERE y.document_id = x.id)
        AND NOT EXISTS (SELECT 1 FROM public.warehouse_document_lines y WHERE y.document_id = x.id AND (y.unit_id IS NULL OR NOT y.unit_id = ANY(u))));
  SELECT coalesce(array_agg(id),'{}') INTO i FROM public.warehouse_issues WHERE request_id = ANY(r) OR unit_id = ANY(u) OR document_id = ANY(d);
  SELECT coalesce(array_agg(id),'{}') INTO l FROM public.warehouse_document_lines WHERE document_id = ANY(d) OR unit_id = ANY(u) OR issue_id = ANY(i);
  SELECT coalesce(array_agg(id),'{}') INTO b FROM public.warehouse_receipt_batches WHERE request_id = ANY(r) OR document_id = ANY(d);
  DELETE FROM public.warehouse_ledger WHERE unit_id = ANY(u) OR document_id = ANY(d) OR line_id = ANY(l);
  DELETE FROM public.warehouse_issue_usages WHERE issue_id = ANY(i);
  DELETE FROM public.warehouse_issue_returns WHERE issue_id = ANY(i) OR document_id = ANY(d);
  DELETE FROM public.warehouse_document_lines WHERE id = ANY(l);
  DELETE FROM public.warehouse_issues WHERE id = ANY(i);
  DELETE FROM public.warehouse_receipt_batch_lines WHERE batch_id = ANY(b) OR unit_id = ANY(u) OR request_item_id = ANY(it);
  DELETE FROM public.warehouse_receipt_batches WHERE id = ANY(b);
  DELETE FROM public.warehouse_request_receipts WHERE request_id = ANY(r) OR document_id = ANY(d);
  DELETE FROM public.warehouse_balances WHERE unit_id = ANY(u);
  DELETE FROM public.warehouse_damaged_balances WHERE unit_id = ANY(u);
  DELETE FROM public.warehouse_inventory_lines WHERE unit_id = ANY(u);
  DELETE FROM public.warehouse_inventories WHERE document_id = ANY(d);
  DELETE FROM public.warehouse_documents WHERE id = ANY(d);
  DELETE FROM public.warehouse_units WHERE id = ANY(u);
  DELETE FROM public.procurement_items WHERE request_id = ANY(r);
  DELETE FROM public.requests WHERE id = ANY(r);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('crss.hard_delete', 'off', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.hard_delete_requests(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hard_delete_requests(uuid[]) TO authenticated;