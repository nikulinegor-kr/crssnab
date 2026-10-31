DROP POLICY IF EXISTS "Users can create org warehouses" ON public.warehouses;
CREATE POLICY "Users can create org warehouses" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.user_has_org_access(auth.uid(), organization_id) AND public.user_can_use_qr_warehouse(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Users can update org warehouses" ON public.warehouses;
CREATE POLICY "Users can update org warehouses" ON public.warehouses FOR UPDATE TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id) AND public.user_can_use_qr_warehouse(auth.uid(), organization_id)) WITH CHECK (public.user_has_org_access(auth.uid(), organization_id) AND public.user_can_use_qr_warehouse(auth.uid(), organization_id));
CREATE OR REPLACE FUNCTION public.warehouse_directory_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN RAISE EXCEPTION 'Укажите название склада' USING ERRCODE = '22023'; END IF;
 NEW.name := btrim(NEW.name);
 IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'Нельзя изменить организацию склада' USING ERRCODE = '42501'; END IF;
 IF NEW.object_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.request_objects WHERE id = NEW.object_id AND organization_id = NEW.organization_id) THEN RAISE EXCEPTION 'Объект другой организации' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER warehouse_directory_validate BEFORE INSERT OR UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.warehouse_directory_guard();
REVOKE EXECUTE ON FUNCTION public.warehouse_directory_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warehouse_keep_qr_token() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warehouse_source_item_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warehouse_line_draft_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warehouse_request_receipt_guard() FROM PUBLIC, anon, authenticated;