-- Issue and record immediate consumption in one transaction. The existing posting
-- functions retain permission checks, row locks and the single stock debit.
CREATE OR REPLACE FUNCTION public.warehouse_issue_and_consume(
  _operation_key uuid, _unit_id uuid, _from_warehouse_id uuid,
  _quantity numeric, _recipient text, _recipient_user_id uuid,
  _operation_date date, _equipment_id uuid, _object_id uuid, _note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_document public.warehouse_documents;
  v_issue public.warehouse_issues;
  v_quantity numeric := 0;
BEGIN
  v_result := public.warehouse_issue(
    _operation_key, _unit_id, _from_warehouse_id, _quantity, _recipient,
    _recipient_user_id, _operation_date, _equipment_id, _object_id, _note
  );
  SELECT * INTO v_document FROM public.warehouse_documents
    WHERE id = (v_result->>'id')::uuid;
  IF v_document.id IS NULL OR v_document.doc_type <> 'issue'
    OR v_document.recipient_name IS DISTINCT FROM btrim(_recipient)
    OR v_document.recipient_user_id IS DISTINCT FROM _recipient_user_id
    OR v_document.operation_date IS DISTINCT FROM _operation_date
    OR v_document.equipment_id IS DISTINCT FROM _equipment_id
    OR v_document.object_id IS DISTINCT FROM _object_id
    OR v_document.comment IS DISTINCT FROM NULLIF(btrim(_note), '') THEN
    RAISE EXCEPTION 'Ключ операции уже использован с другими параметрами';
  END IF;

  FOR v_issue IN SELECT * FROM public.warehouse_issues
    WHERE document_id = v_document.id ORDER BY id
  LOOP
    IF v_issue.unit_id <> _unit_id OR v_issue.warehouse_id <> _from_warehouse_id THEN
      RAISE EXCEPTION 'Ключ операции уже использован для другой выдачи';
    END IF;
    v_quantity := v_quantity + v_issue.issued_qty;
    PERFORM public.warehouse_issue_usage(
      md5(_operation_key::text || ':consume:' || v_issue.id::text)::uuid,
      v_issue.id, 'consume', v_issue.issued_qty, NULL, _operation_date, _note
    );
  END LOOP;
  IF v_quantity IS DISTINCT FROM _quantity THEN
    RAISE EXCEPTION 'Количество отличается от первоначальной выдачи';
  END IF;
  RETURN v_result || jsonb_build_object('consumed_now', true);
END;
$$;

REVOKE ALL ON FUNCTION public.warehouse_issue_and_consume(uuid,uuid,uuid,numeric,text,uuid,date,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_issue_and_consume(uuid,uuid,uuid,numeric,text,uuid,date,uuid,uuid,text) TO authenticated;