CREATE OR REPLACE FUNCTION public.simple_warehouse_operation(_operation_key uuid, _unit_id uuid, _type text, _from_warehouse_id uuid, _quantity numeric, _recipient text, _operation_date date, _equipment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF _type = 'issue' THEN
    RETURN public.warehouse_issue(_operation_key,_unit_id,_from_warehouse_id,_quantity,_recipient,NULL::uuid,_operation_date,_equipment_id,NULL::uuid,NULL::text);
  END IF;
  RETURN public.simple_warehouse_operation(_operation_key,_unit_id,_type,_from_warehouse_id,NULL::uuid,_quantity,_recipient,_operation_date,_equipment_id,NULL::uuid);
END $$;
GRANT EXECUTE ON FUNCTION public.simple_warehouse_operation(uuid,uuid,text,uuid,numeric,text,date,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.simple_warehouse_operation(uuid,uuid,text,uuid,numeric,text,date,uuid) FROM anon;
NOTIFY pgrst, 'reload schema';