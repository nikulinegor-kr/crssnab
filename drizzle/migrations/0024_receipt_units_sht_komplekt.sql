DO $mig$
DECLARE d text; chk text := $c$IF v_unit NOT IN ('шт','комплект') THEN RAISE EXCEPTION 'Единица: только шт или комплект'; END IF;
 $c$;
BEGIN
 d := pg_get_functiondef('public.manual_warehouse_receipt(uuid,uuid,text,text,numeric,text,text,text)'::regprocedure);
 IF position('только шт' in d)=0 THEN
  IF position('IF _kind NOT IN' in d)=0 THEN RAISE EXCEPTION 'manual anchor missing'; END IF;
  EXECUTE replace(d,'IF _kind NOT IN', chk||'IF _kind NOT IN');
 END IF;
 d := pg_get_functiondef('public.receive_warehouse_request(uuid,uuid,uuid,jsonb)'::regprocedure);
 IF position('только шт' in d)=0 THEN
  IF position('IF v_fallback THEN v_name:=' in d)=0 THEN RAISE EXCEPTION 'receive anchor missing'; END IF;
  EXECUTE replace(d,'IF v_fallback THEN v_name:=', chk||'IF v_fallback THEN v_name:=');
 END IF;
END $mig$;