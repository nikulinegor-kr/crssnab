GRANT DELETE ON public.warehouses TO authenticated;
DROP POLICY IF EXISTS "Users can delete org warehouses" ON public.warehouses;
CREATE POLICY "Users can delete org warehouses" ON public.warehouses FOR DELETE TO authenticated USING (public.user_has_org_access(auth.uid(),organization_id) AND public.user_can_use_qr_warehouse(auth.uid(),organization_id));
CREATE POLICY warehouse_delete_permission_guard ON public.warehouses AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_has_org_access(auth.uid(),organization_id) AND public.user_can_use_qr_warehouse(auth.uid(),organization_id));
CREATE OR REPLACE FUNCTION public.warehouse_delete_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fk record; used boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.user_can_use_qr_warehouse(auth.uid(),OLD.organization_id) THEN RAISE EXCEPTION 'Нет доступа к удалению склада' USING ERRCODE='42501'; END IF;
 -- Prevent CASCADE and SET NULL from erasing history or disconnecting live requests.
 FOR fk IN SELECT n.nspname AS schema_name,t.relname AS table_name,a.attname AS column_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='public.warehouses'::regclass AND cardinality(c.conkey)=1 LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',fk.schema_name,fk.table_name,fk.column_name) INTO used USING OLD.id;
  IF used THEN RAISE EXCEPTION 'Склад используется: есть остатки, операции, ячейки или связанные заявки/объекты. Удаление запрещено, чтобы сохранить данные.' USING ERRCODE='23503'; END IF;
 END LOOP;
 RETURN OLD;
END $$;
CREATE TRIGGER warehouse_delete_validate BEFORE DELETE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.warehouse_delete_guard();
REVOKE EXECUTE ON FUNCTION public.warehouse_delete_guard() FROM PUBLIC,anon,authenticated;