DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.confirm_request_qr_logistics(uuid,uuid,text,text,date,date,date)'::regprocedure);
 IF position('IF r.status<>''В пути'' THEN' in d)=0 THEN RAISE EXCEPTION 'Unexpected QR logistics function; no change applied'; END IF;
 d:=replace(d,'IF r.status<>''В пути'' THEN','IF r.status NOT IN (''В пути'',''Доставлено в ТК'') THEN');
 d:=replace(d,'Подтверждение доставки доступно только в статусе В пути; обновите заявку','Подтверждение доставки доступно в статусах В пути и Доставлено в ТК; обновите заявку');
 EXECUTE d;
END $$;