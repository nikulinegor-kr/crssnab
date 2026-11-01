-- Full warehouse cycle (additive): partial request receipts, warehouse archive, issue confirmation,
-- install/consume/return with damaged stock, linked corrections and inventory counts.

ALTER TABLE public.warehouse_documents DROP CONSTRAINT IF EXISTS warehouse_documents_doc_type_check;
ALTER TABLE public.warehouse_documents ADD CONSTRAINT warehouse_documents_doc_type_check CHECK (doc_type = ANY (ARRAY['receipt','move','issue','return','correction','inventory']));

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS installed_qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS consumed_qty numeric NOT NULL DEFAULT 0;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS received_confirmed_at timestamptz;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS received_confirmed_by uuid;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS received_confirmed_proxy boolean NOT NULL DEFAULT false;
ALTER TABLE public.warehouse_issues ADD CONSTRAINT warehouse_issues_usage_limit CHECK (installed_qty >= 0 AND consumed_qty >= 0 AND returned_qty + installed_qty + consumed_qty <= issued_qty);
CREATE INDEX IF NOT EXISTS warehouse_issues_org_created_idx ON public.warehouse_issues(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS warehouse_issues_recipient_idx ON public.warehouse_issues(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS warehouse_ledger_wh_id_idx ON public.warehouse_ledger(warehouse_id, id);

-- Partial receipts -------------------------------------------------------------------------
CREATE TABLE public.warehouse_receipt_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 request_id uuid NOT NULL REFERENCES public.requests(id),
 document_id uuid UNIQUE REFERENCES public.warehouse_documents(id),
 warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
 received_by uuid NOT NULL,
 receiver_name text NOT NULL,
 discrepancy_confirmed boolean NOT NULL DEFAULT false,
 operation_key uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, operation_key));
CREATE TABLE public.warehouse_receipt_batch_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 batch_id uuid NOT NULL REFERENCES public.warehouse_receipt_batches(id),
 request_item_id uuid REFERENCES public.request_items(id),
 unit_id uuid REFERENCES public.warehouse_units(id),
 expected_qty numeric NOT NULL CHECK (expected_qty > 0),
 accepted_qty numeric NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
 defect_qty numeric NOT NULL DEFAULT 0 CHECK (defect_qty >= 0),
 unit text NOT NULL,
 note text,
 photo_paths text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (accepted_qty + defect_qty > 0));
CREATE INDEX warehouse_receipt_batches_request_idx ON public.warehouse_receipt_batches(request_id);
CREATE INDEX warehouse_receipt_batch_lines_batch_idx ON public.warehouse_receipt_batch_lines(batch_id);
CREATE INDEX warehouse_receipt_batch_lines_item_idx ON public.warehouse_receipt_batch_lines(request_item_id);
GRANT SELECT ON public.warehouse_receipt_batches, public.warehouse_receipt_batch_lines TO authenticated;
GRANT ALL ON public.warehouse_receipt_batches, public.warehouse_receipt_batch_lines TO service_role;
ALTER TABLE public.warehouse_receipt_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_receipt_batch_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_batches_read ON public.warehouse_receipt_batches FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id) AND EXISTS(SELECT 1 FROM public.requests r WHERE r.id = request_id));
CREATE POLICY receipt_batch_lines_read ON public.warehouse_receipt_batch_lines FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id) AND EXISTS(SELECT 1 FROM public.warehouse_receipt_batches b WHERE b.id = batch_id));

-- Damaged stock, usages, returns ------------------------------------------------------------
CREATE TABLE public.warehouse_damaged_balances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
 warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
 quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(unit_id, warehouse_id));
CREATE INDEX warehouse_damaged_balances_org_idx ON public.warehouse_damaged_balances(organization_id, warehouse_id);
CREATE TABLE public.warehouse_issue_usages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 issue_id uuid NOT NULL REFERENCES public.warehouse_issues(id),
 kind text NOT NULL CHECK (kind IN ('install','consume')),
 quantity numeric NOT NULL CHECK (quantity > 0),
 equipment_id uuid REFERENCES public.equipment(id),
 operation_date date NOT NULL,
 note text,
 reversal_of uuid UNIQUE REFERENCES public.warehouse_issue_usages(id),
 reason text,
 operation_key uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, operation_key));
CREATE INDEX warehouse_issue_usages_issue_idx ON public.warehouse_issue_usages(issue_id);
CREATE TABLE public.warehouse_issue_returns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 issue_id uuid NOT NULL REFERENCES public.warehouse_issues(id),
 quantity numeric NOT NULL CHECK (quantity > 0),
 warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
 condition text NOT NULL CHECK (condition IN ('good','damaged')),
 document_id uuid REFERENCES public.warehouse_documents(id),
 note text,
 reversal_of uuid UNIQUE REFERENCES public.warehouse_issue_returns(id),
 reason text,
 operation_key uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, operation_key));
CREATE INDEX warehouse_issue_returns_issue_idx ON public.warehouse_issue_returns(issue_id);
GRANT SELECT ON public.warehouse_damaged_balances, public.warehouse_issue_usages, public.warehouse_issue_returns TO authenticated;
GRANT ALL ON public.warehouse_damaged_balances, public.warehouse_issue_usages, public.warehouse_issue_returns TO service_role;
ALTER TABLE public.warehouse_damaged_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_issue_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_issue_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY damaged_read ON public.warehouse_damaged_balances FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY usages_read ON public.warehouse_issue_usages FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY returns_read ON public.warehouse_issue_returns FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));

-- Inventory ----------------------------------------------------------------------------------
CREATE TABLE public.warehouse_inventories(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
 snapshot_ledger_id bigint NOT NULL DEFAULT 0,
 snapshot_at timestamptz NOT NULL DEFAULT now(),
 document_id uuid REFERENCES public.warehouse_documents(id),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 posted_by uuid,
 posted_at timestamptz);
CREATE UNIQUE INDEX warehouse_inventories_one_draft ON public.warehouse_inventories(warehouse_id) WHERE status = 'draft';
CREATE TABLE public.warehouse_inventory_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 inventory_id uuid NOT NULL REFERENCES public.warehouse_inventories(id),
 unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
 expected_qty numeric NOT NULL DEFAULT 0 CHECK (expected_qty >= 0),
 counted_qty numeric CHECK (counted_qty >= 0),
 reason text,
 counted_by uuid,
 counted_at timestamptz,
 UNIQUE(inventory_id, unit_id));
GRANT SELECT ON public.warehouse_inventories, public.warehouse_inventory_lines TO authenticated;
GRANT ALL ON public.warehouse_inventories, public.warehouse_inventory_lines TO service_role;
ALTER TABLE public.warehouse_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventories_read ON public.warehouse_inventories FOR SELECT TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id));
CREATE POLICY inventory_lines_read ON public.warehouse_inventory_lines FOR SELECT TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id));

-- Helpers ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.warehouse_next_number(_org uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_seq int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('warehouse_doc_number:' || _org::text, 0));
 SELECT COALESCE(max(split_part(number, '-', 3)::int), 0) + 1 INTO v_seq FROM warehouse_documents WHERE organization_id = _org AND number LIKE 'СК-' || to_char(now(), 'YYYY') || '-%';
 RETURN 'СК-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
END $$;
REVOKE ALL ON FUNCTION public.warehouse_next_number(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.warehouse_archive_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
 IF (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.archived_by IS DISTINCT FROM OLD.archived_by) AND COALESCE(current_setting('app.warehouse_archive', true), '') <> '1' THEN
  RAISE EXCEPTION 'Архивирование склада выполняется только через проверку остатков' USING ERRCODE = '42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER warehouse_archive_guard BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.warehouse_archive_guard();

-- Archived warehouses accept no new movements (existing history untouched).
CREATE OR REPLACE FUNCTION public.warehouse_apply_delta(_org uuid, _doc uuid, _line uuid, _unit uuid, _wh uuid, _cell uuid, _delta numeric, _op text, _actor uuid)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid; v_qty numeric;
BEGIN
  IF _wh IS NULL THEN RAISE EXCEPTION 'Не указан склад' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = _wh AND organization_id = _org) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM warehouses WHERE id = _wh AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Склад в архиве: новые движения запрещены' USING ERRCODE = 'P0001'; END IF;
  IF _cell IS NOT NULL AND NOT EXISTS (SELECT 1 FROM warehouse_cells WHERE id = _cell AND warehouse_id = _wh AND organization_id = _org) THEN
    RAISE EXCEPTION 'Ячейка не принадлежит складу' USING ERRCODE = 'P0001'; END IF;
  SELECT id, quantity INTO v_id, v_qty FROM warehouse_balances
   WHERE unit_id = _unit AND warehouse_id = _wh AND cell_id IS NOT DISTINCT FROM _cell FOR UPDATE;
  IF v_id IS NULL THEN
    IF _delta < 0 THEN RAISE EXCEPTION 'Недостаточно остатка в месте хранения' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO warehouse_balances(organization_id, unit_id, warehouse_id, cell_id, quantity)
    VALUES (_org, _unit, _wh, _cell, _delta) RETURNING quantity INTO v_qty;
  ELSE
    IF v_qty + _delta < 0 THEN RAISE EXCEPTION 'Недостаточно остатка: доступно %, требуется %', v_qty, -_delta USING ERRCODE = 'P0001'; END IF;
    UPDATE warehouse_balances SET quantity = quantity + _delta, updated_at = now() WHERE id = v_id RETURNING quantity INTO v_qty;
  END IF;
  INSERT INTO warehouse_ledger(organization_id, document_id, line_id, unit_id, warehouse_id, cell_id, operation, delta, balance_after, created_by)
  VALUES (_org, _doc, _line, _unit, _wh, _cell, _op, _delta, v_qty, _actor);
  RETURN v_qty;
END $function$;

-- Posting: receipt access also via partial receipt batches; issue may target an employee.
CREATE OR REPLACE FUNCTION public.post_warehouse_document(_document_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d warehouse_documents; l record; u warehouse_units; i warehouse_issues; v_actor uuid := auth.uid(); v_total numeric; v_seq int; v_count int := 0;
BEGIN
 SELECT * INTO d FROM warehouse_documents WHERE id = _document_id FOR UPDATE;
 IF d.id IS NULL OR NOT (public.user_can_use_qr_warehouse(v_actor, d.organization_id) OR (d.doc_type = 'receipt' AND public.user_has_org_access(v_actor, d.organization_id) AND (EXISTS(SELECT 1 FROM public.warehouse_request_receipts rr WHERE rr.document_id = d.id) OR EXISTS(SELECT 1 FROM public.warehouse_receipt_batches rb WHERE rb.document_id = d.id)))) THEN RAISE EXCEPTION 'Нет доступа к документу' USING ERRCODE = '42501'; END IF;
 IF d.status = 'posted' THEN RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', true); END IF;
 IF d.doc_type IN ('correction','inventory') THEN RAISE EXCEPTION 'Документ проводится только своей операцией'; END IF;
 IF d.doc_type = 'issue' AND (COALESCE(btrim(d.recipient_name), '') = '' OR (d.request_id IS NULL AND d.object_id IS NULL AND d.equipment_id IS NULL AND d.recipient_user_id IS NULL)) THEN RAISE EXCEPTION 'Для выдачи укажите получателя и заявку, технику, объект или сотрудника'; END IF;
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
 IF i.returned_qty + i.installed_qty + i.consumed_qty + l.quantity > i.issued_qty THEN RAISE EXCEPTION 'Возврат больше числящегося: выдано %, уже возвращено/использовано %', i.issued_qty, i.returned_qty + i.installed_qty + i.consumed_qty; END IF;
 UPDATE warehouse_issues SET returned_qty = returned_qty + l.quantity WHERE id = i.id;
 PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, COALESCE(l.to_warehouse_id, i.warehouse_id), CASE WHEN l.to_warehouse_id IS NULL THEN i.cell_id ELSE l.to_cell_id END, l.quantity, 'return', v_actor);
 END IF; END LOOP;
 IF v_count = 0 THEN RAISE EXCEPTION 'В документе нет позиций'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('warehouse_doc_number:' || d.organization_id::text, 0));
 SELECT COALESCE(max(split_part(number, '-', 3)::int), 0) + 1 INTO v_seq FROM warehouse_documents WHERE organization_id = d.organization_id AND number LIKE 'СК-' || to_char(now(), 'YYYY') || '-%';
 UPDATE warehouse_documents SET status = 'posted', posted_at = now(), posted_by = v_actor, number = 'СК-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0') WHERE id = d.id RETURNING * INTO d;
 RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', false);
END $function$;

-- Receipt guards recognise partial batches.
CREATE OR REPLACE FUNCTION public.warehouse_request_receipt_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN
 IF NEW.status='posted' AND OLD.status='draft' AND NEW.doc_type='receipt' THEN
 IF NEW.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=NEW.request_id AND document_id=NEW.id) AND NOT EXISTS(SELECT 1 FROM public.warehouse_receipt_batches WHERE request_id=NEW.request_id AND document_id=NEW.id) THEN RAISE EXCEPTION 'Осуществите приёмку из заявки'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_document_lines l JOIN public.warehouse_units u ON u.id=l.unit_id WHERE l.document_id=NEW.id AND (u.source_request_id IS NOT NULL OR u.request_item_id IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts r WHERE r.document_id=NEW.id AND (r.request_id=u.source_request_id OR EXISTS(SELECT 1 FROM public.request_items it WHERE it.id=u.request_item_id AND it.request_id=r.request_id)))
   AND NOT EXISTS(SELECT 1 FROM public.warehouse_receipt_batches b WHERE b.document_id=NEW.id AND b.request_id=u.source_request_id)) THEN RAISE EXCEPTION 'Повторная приёмка ТМЦ заявки запрещена'; END IF;
 END IF; RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.warehouse_source_item_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE v_request uuid; BEGIN FOR v_request IN SELECT DISTINCT id FROM (VALUES (CASE WHEN TG_OP<>'INSERT' THEN OLD.request_id END),(CASE WHEN TG_OP<>'DELETE' THEN NEW.request_id END)) q(id) WHERE id IS NOT NULL ORDER BY id LOOP PERFORM 1 FROM public.requests WHERE id=v_request FOR UPDATE; IF EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=v_request) OR EXISTS(SELECT 1 FROM public.warehouse_receipt_batches WHERE request_id=v_request) THEN RAISE EXCEPTION 'Позиции принятой на склад заявки нельзя изменять'; END IF; END LOOP; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.warehouse_legacy_receipt_after_partial() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.warehouse_receipt_batches WHERE request_id=NEW.request_id) THEN RAISE EXCEPTION 'По заявке уже идёт поэтапная приёмка'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER warehouse_legacy_receipt_after_partial BEFORE INSERT ON public.warehouse_request_receipts FOR EACH ROW EXECUTE FUNCTION public.warehouse_legacy_receipt_after_partial();

-- 1. Partial receipt by lines --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_request_partial(_operation_key uuid, _request_id uuid, _warehouse_id uuid, _received_by uuid, _lines jsonb, _confirm_discrepancy boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.requests; v_actor uuid := auth.uid(); b public.warehouse_receipt_batches; x jsonb; it public.request_items; v_doc uuid; v_batch uuid; v_receiver text;
 v_fallback boolean; v_acc numeric; v_def numeric; v_exp numeric; v_done numeric; v_unit text; v_name text; v_uid uuid; v_photos text[]; v_note text; v_discrepancy boolean := false; v_any_accept boolean := false; v_prev_exp numeric;
BEGIN
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT * INTO r FROM public.requests WHERE id = _request_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.user_has_org_access(v_actor, r.organization_id) OR NOT public.user_can_view_request(v_actor, r.organization_id, r.applicant_user_id) THEN RAISE EXCEPTION 'Нет доступа к приёмке заявки' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.warehouse_receipt_batches WHERE organization_id = r.organization_id AND operation_key = _operation_key;
 IF b.id IS NOT NULL THEN
  IF b.request_id <> r.id THEN RAISE EXCEPTION 'Ключ операции уже использован'; END IF;
  RETURN jsonb_build_object('batch_id', b.id, 'document_id', b.document_id, 'already', true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id = r.id) THEN RAISE EXCEPTION 'Заявка уже принята полностью'; END IF;
 IF r.status NOT IN ('В пути','Доставлено в ТК','Доставлено') THEN RAISE EXCEPTION 'Приёмка доступна для заявок В пути, Доставлено в ТК или Доставлено'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id = _warehouse_id AND organization_id = r.organization_id) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouses WHERE id = _warehouse_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Склад в архиве: новые движения запрещены'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id = _received_by AND organization_id = r.organization_id AND is_active) THEN RAISE EXCEPTION 'Приёмщик не является действующим сотрудником' USING ERRCODE='42501'; END IF;
 SELECT full_name INTO v_receiver FROM public.profiles WHERE id = _received_by;
 IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN RAISE EXCEPTION 'Укажите принятые позиции'; END IF;
 v_fallback := NOT EXISTS(SELECT 1 FROM public.request_items WHERE request_id = r.id);
 IF v_fallback THEN
  IF jsonb_array_length(_lines) <> 1 OR (_lines->0->>'item_id') IS NOT NULL THEN RAISE EXCEPTION 'Без позиций подтвердите одну строку заявки'; END IF;
  IF NULLIF(btrim(r.description),'') IS NULL THEN RAISE EXCEPTION 'Укажите название заявки'; END IF;
 ELSIF (SELECT count(DISTINCT value->>'item_id') FROM jsonb_array_elements(_lines)) <> jsonb_array_length(_lines) OR EXISTS(SELECT 1 FROM jsonb_array_elements(_lines) WHERE value->>'item_id' IS NULL) THEN RAISE EXCEPTION 'Позиции не должны повторяться'; END IF;
 INSERT INTO public.warehouse_receipt_batches(organization_id, request_id, warehouse_id, received_by, receiver_name, discrepancy_confirmed, operation_key, created_by)
  VALUES (r.organization_id, r.id, _warehouse_id, _received_by, COALESCE(NULLIF(v_receiver,''),'—'), COALESCE(_confirm_discrepancy,false), _operation_key, v_actor) RETURNING id INTO v_batch;
 FOR x IN SELECT value FROM jsonb_array_elements(_lines) LOOP
  v_acc := COALESCE((x->>'accepted')::numeric, 0); v_def := COALESCE((x->>'defect')::numeric, 0); v_unit := NULLIF(btrim(x->>'unit'),''); v_note := NULLIF(btrim(x->>'note'),'');
  IF v_acc < 0 OR v_def < 0 OR v_acc + v_def <= 0 OR v_acc::text IN ('NaN','Infinity') OR v_def::text IN ('NaN','Infinity') THEN RAISE EXCEPTION 'Укажите принятое количество больше нуля'; END IF;
  IF v_unit IS NULL OR v_unit NOT IN ('шт','комплект') THEN RAISE EXCEPTION 'Единица: только шт или комплект'; END IF;
  SELECT COALESCE(array_agg(p), '{}') INTO v_photos FROM jsonb_array_elements_text(COALESCE(x->'photos','[]'::jsonb)) p;
  IF cardinality(v_photos) > 10 OR EXISTS(SELECT 1 FROM unnest(v_photos) p WHERE p NOT LIKE r.request_number || '/warehouse-receipt/%' OR p LIKE '%..%') THEN RAISE EXCEPTION 'Недопустимые фото'; END IF;
  IF v_def > 0 AND v_note IS NULL THEN RAISE EXCEPTION 'Для брака укажите примечание'; END IF;
  IF v_fallback THEN
   v_name := btrim(r.description); it := NULL;
   SELECT l.expected_qty INTO v_prev_exp FROM public.warehouse_receipt_batch_lines l JOIN public.warehouse_receipt_batches bb ON bb.id = l.batch_id WHERE bb.request_id = r.id AND l.request_item_id IS NULL ORDER BY l.created_at LIMIT 1;
   v_exp := COALESCE(v_prev_exp, (x->>'expected')::numeric);
   IF v_exp IS NULL OR v_exp <= 0 THEN RAISE EXCEPTION 'Подтвердите ожидаемое количество'; END IF;
   IF v_prev_exp IS NOT NULL AND (x->>'expected') IS NOT NULL AND (x->>'expected')::numeric <> v_prev_exp THEN RAISE EXCEPTION 'Ожидаемое количество уже подтверждено: %', v_prev_exp; END IF;
   SELECT COALESCE(sum(l.accepted_qty + l.defect_qty),0) INTO v_done FROM public.warehouse_receipt_batch_lines l JOIN public.warehouse_receipt_batches bb ON bb.id = l.batch_id WHERE bb.request_id = r.id AND l.request_item_id IS NULL AND l.batch_id <> v_batch;
  ELSE
   SELECT * INTO it FROM public.request_items WHERE id = (x->>'item_id')::uuid AND request_id = r.id AND organization_id = r.organization_id FOR UPDATE;
   IF it.id IS NULL THEN RAISE EXCEPTION 'Позиция не принадлежит заявке'; END IF;
   v_name := it.name; v_exp := it.quantity;
   SELECT COALESCE(sum(accepted_qty + defect_qty),0) INTO v_done FROM public.warehouse_receipt_batch_lines WHERE request_item_id = it.id AND batch_id <> v_batch;
  END IF;
  IF v_done + v_acc + v_def > v_exp THEN RAISE EXCEPTION 'Больше ожидаемого по «%»: осталось получить %', v_name, v_exp - v_done; END IF;
  IF v_def > 0 OR v_done + v_acc + v_def < v_exp THEN v_discrepancy := true; END IF;
  v_uid := NULL;
  IF v_acc > 0 THEN
   IF v_doc IS NULL THEN INSERT INTO public.warehouse_documents(organization_id, doc_type, request_id, created_by, recipient_user_id, operation_key, operation_date) VALUES (r.organization_id, 'receipt', r.id, v_actor, _received_by, _operation_key, current_date) RETURNING id INTO v_doc; END IF;
   INSERT INTO public.warehouse_units(organization_id, kind, name, unit, batch_number, request_item_id, source_request_id, request_title, request_number, created_by)
    VALUES (r.organization_id, 'batch', v_name, v_unit, r.request_number, it.id, r.id, btrim(r.description), r.request_number, v_actor) RETURNING id INTO v_uid;
   INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, to_warehouse_id) VALUES (r.organization_id, v_doc, v_uid, v_acc, _warehouse_id);
   v_any_accept := true;
  END IF;
  INSERT INTO public.warehouse_receipt_batch_lines(organization_id, batch_id, request_item_id, unit_id, expected_qty, accepted_qty, defect_qty, unit, note, photo_paths)
   VALUES (r.organization_id, v_batch, it.id, v_uid, v_exp, v_acc, v_def, v_unit, v_note, v_photos);
 END LOOP;
 IF NOT v_fallback AND EXISTS(SELECT 1 FROM public.request_items i WHERE i.request_id = r.id AND i.quantity > (SELECT COALESCE(sum(accepted_qty+defect_qty),0) FROM public.warehouse_receipt_batch_lines WHERE request_item_id = i.id)) THEN v_discrepancy := true; END IF;
 IF v_discrepancy AND NOT COALESCE(_confirm_discrepancy,false) THEN RAISE EXCEPTION 'Есть расхождения (недостача или брак): подтвердите их явно'; END IF;
 IF v_doc IS NOT NULL THEN
  UPDATE public.warehouse_receipt_batches SET document_id = v_doc WHERE id = v_batch;
  PERFORM public.post_warehouse_document(v_doc);
 END IF;
 RETURN jsonb_build_object('batch_id', v_batch, 'document_id', v_doc, 'already', false, 'discrepancy', v_discrepancy);
END $$;

-- 2. Archive -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_warehouse_archived(_warehouse_id uuid, _archived boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.warehouses; v_actor uuid := auth.uid();
BEGIN
 SELECT * INTO w FROM public.warehouses WHERE id = _warehouse_id FOR UPDATE;
 IF w.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, w.organization_id) OR NOT public.user_is_org_admin(v_actor, w.organization_id) THEN RAISE EXCEPTION 'Нет доступа к архивированию склада' USING ERRCODE='42501'; END IF;
 IF _archived THEN
  IF w.archived_at IS NOT NULL THEN RETURN jsonb_build_object('id', w.id, 'already', true); END IF;
  PERFORM 1 FROM public.warehouse_balances WHERE warehouse_id = w.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.warehouse_balances WHERE warehouse_id = w.id AND quantity > 0) OR EXISTS(SELECT 1 FROM public.warehouse_damaged_balances WHERE warehouse_id = w.id AND quantity > 0) THEN RAISE EXCEPTION 'На складе есть остатки: переместите или выдайте их перед архивированием'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_inventories WHERE warehouse_id = w.id AND status = 'draft') OR EXISTS(SELECT 1 FROM public.warehouse_document_lines l JOIN public.warehouse_documents d ON d.id = l.document_id WHERE d.status = 'draft' AND (l.from_warehouse_id = w.id OR l.to_warehouse_id = w.id)) THEN RAISE EXCEPTION 'Есть незавершённые операции по складу'; END IF;
 ELSIF w.archived_at IS NULL THEN RETURN jsonb_build_object('id', w.id, 'already', true); END IF;
 PERFORM set_config('app.warehouse_archive', '1', true);
 UPDATE public.warehouses SET archived_at = CASE WHEN _archived THEN now() END, archived_by = CASE WHEN _archived THEN v_actor END WHERE id = w.id;
 PERFORM set_config('app.warehouse_archive', '', true);
 RETURN jsonb_build_object('id', w.id, 'already', false);
END $$;

-- 4. Issue with recipient, note and confirmation ---------------------------------------------
CREATE OR REPLACE FUNCTION public.warehouse_issue(_operation_key uuid, _unit_id uuid, _from_warehouse_id uuid, _quantity numeric, _recipient text, _recipient_user_id uuid, _operation_date date, _equipment_id uuid, _object_id uuid, _note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u public.warehouse_units; b record; v_doc uuid; v_left numeric := _quantity; v_part numeric; v_result jsonb; v_actor uuid := auth.uid();
BEGIN
 SELECT * INTO u FROM public.warehouse_units WHERE id = _unit_id FOR UPDATE;
 IF u.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, u.organization_id) THEN RAISE EXCEPTION 'Нет доступа к ТМЦ' USING ERRCODE='42501'; END IF;
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT id INTO v_doc FROM public.warehouse_documents WHERE organization_id = u.organization_id AND operation_key = _operation_key;
 IF v_doc IS NOT NULL THEN RETURN public.post_warehouse_document(v_doc); END IF;
 IF _quantity IS NULL OR _quantity <= 0 OR _quantity::text IN ('NaN','Infinity') OR (u.kind = 'item' AND _quantity <> 1) THEN RAISE EXCEPTION 'Недопустимое количество'; END IF;
 IF COALESCE(btrim(_recipient),'') = '' OR _operation_date IS NULL THEN RAISE EXCEPTION 'Укажите получателя и дату'; END IF;
 IF _equipment_id IS NOT NULL AND _object_id IS NOT NULL THEN RAISE EXCEPTION 'Выберите технику либо объект'; END IF;
 IF _equipment_id IS NULL AND _object_id IS NULL AND _recipient_user_id IS NULL THEN RAISE EXCEPTION 'Выберите объект, технику или сотрудника'; END IF;
 IF _recipient_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id = _recipient_user_id AND organization_id = u.organization_id AND is_active) THEN RAISE EXCEPTION 'Получатель не является сотрудником организации' USING ERRCODE='42501'; END IF;
 IF _equipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.equipment WHERE id = _equipment_id AND organization_id = u.organization_id) THEN RAISE EXCEPTION 'Техника другой организации' USING ERRCODE='42501'; END IF;
 IF _object_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.request_objects WHERE id = _object_id AND organization_id = u.organization_id) THEN RAISE EXCEPTION 'Объект другой организации' USING ERRCODE='42501'; END IF;
 INSERT INTO public.warehouse_documents(organization_id, doc_type, recipient_name, recipient_user_id, object_id, equipment_id, operation_date, operation_key, created_by, comment)
  VALUES (u.organization_id, 'issue', btrim(_recipient), _recipient_user_id, _object_id, _equipment_id, _operation_date, _operation_key, v_actor, NULLIF(btrim(_note),'')) RETURNING id INTO v_doc;
 FOR b IN SELECT * FROM public.warehouse_balances WHERE unit_id = u.id AND warehouse_id = _from_warehouse_id AND organization_id = u.organization_id AND quantity > 0 ORDER BY id FOR UPDATE LOOP
  EXIT WHEN v_left <= 0; v_part := least(v_left, b.quantity);
  INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, from_warehouse_id, from_cell_id) VALUES (u.organization_id, v_doc, u.id, v_part, b.warehouse_id, b.cell_id);
  v_left := v_left - v_part;
 END LOOP;
 IF v_left > 0 THEN RAISE EXCEPTION 'Недостаточно остатка'; END IF;
 v_result := public.post_warehouse_document(v_doc);
 UPDATE public.warehouse_issues SET note = NULLIF(btrim(_note),'') WHERE document_id = v_doc;
 RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_issue_received(_issue_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i public.warehouse_issues; v_actor uuid := auth.uid(); v_proxy boolean;
BEGIN
 SELECT * INTO i FROM public.warehouse_issues WHERE id = _issue_id FOR UPDATE;
 IF i.id IS NULL OR NOT public.user_has_org_access(v_actor, i.organization_id) THEN RAISE EXCEPTION 'Нет доступа к выдаче' USING ERRCODE='42501'; END IF;
 IF i.received_confirmed_at IS NOT NULL THEN RETURN jsonb_build_object('id', i.id, 'already', true, 'confirmed_at', i.received_confirmed_at); END IF;
 IF i.recipient_user_id IS NOT NULL AND i.recipient_user_id = v_actor THEN v_proxy := false;
 ELSIF public.user_can_use_qr_warehouse(v_actor, i.organization_id) AND public.user_is_org_admin(v_actor, i.organization_id) THEN v_proxy := true;
 ELSE RAISE EXCEPTION 'Подтвердить получение может только получатель или администратор склада' USING ERRCODE='42501'; END IF;
 UPDATE public.warehouse_issues SET received_confirmed_at = now(), received_confirmed_by = v_actor, received_confirmed_proxy = v_proxy WHERE id = i.id;
 RETURN jsonb_build_object('id', i.id, 'already', false, 'proxy', v_proxy);
END $$;

-- 5. Install / consume ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.warehouse_issue_usage(_operation_key uuid, _issue_id uuid, _kind text, _quantity numeric, _equipment_id uuid, _operation_date date, _note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i public.warehouse_issues; v_actor uuid := auth.uid(); v_id uuid; v_free numeric; v_eq uuid;
BEGIN
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT * INTO i FROM public.warehouse_issues WHERE id = _issue_id FOR UPDATE;
 IF i.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, i.organization_id) THEN RAISE EXCEPTION 'Нет доступа к выдаче' USING ERRCODE='42501'; END IF;
 SELECT id INTO v_id FROM public.warehouse_issue_usages WHERE organization_id = i.organization_id AND operation_key = _operation_key;
 IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'already', true); END IF;
 IF _kind NOT IN ('install','consume') OR _kind IS NULL THEN RAISE EXCEPTION 'Недопустимая операция'; END IF;
 IF _quantity IS NULL OR _quantity <= 0 OR _quantity::text IN ('NaN','Infinity') THEN RAISE EXCEPTION 'Количество должно быть больше нуля'; END IF;
 IF _operation_date IS NULL THEN RAISE EXCEPTION 'Укажите дату'; END IF;
 v_free := i.issued_qty - i.returned_qty - i.installed_qty - i.consumed_qty;
 IF _quantity > v_free THEN RAISE EXCEPTION 'Больше числящегося: доступно %', v_free; END IF;
 v_eq := CASE WHEN _kind = 'install' THEN COALESCE(_equipment_id, i.equipment_id) END;
 IF _kind = 'install' AND v_eq IS NULL THEN RAISE EXCEPTION 'Для установки выберите технику'; END IF;
 IF v_eq IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.equipment WHERE id = v_eq AND organization_id = i.organization_id) THEN RAISE EXCEPTION 'Техника другой организации' USING ERRCODE='42501'; END IF;
 INSERT INTO public.warehouse_issue_usages(organization_id, issue_id, kind, quantity, equipment_id, operation_date, note, operation_key, created_by)
  VALUES (i.organization_id, i.id, _kind, _quantity, v_eq, _operation_date, NULLIF(btrim(_note),''), _operation_key, v_actor) RETURNING id INTO v_id;
 UPDATE public.warehouse_issues SET installed_qty = installed_qty + CASE WHEN _kind='install' THEN _quantity ELSE 0 END, consumed_qty = consumed_qty + CASE WHEN _kind='consume' THEN _quantity ELSE 0 END WHERE id = i.id;
 RETURN jsonb_build_object('id', v_id, 'already', false);
END $$;

-- 6. Returns (good to stock, damaged separately) -------------------------------------------------
CREATE OR REPLACE FUNCTION public.warehouse_return_issue(_operation_key uuid, _issue_id uuid, _quantity numeric, _warehouse_id uuid, _condition text, _note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i public.warehouse_issues; v_actor uuid := auth.uid(); v_id uuid; v_free numeric; v_doc uuid;
BEGIN
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 SELECT * INTO i FROM public.warehouse_issues WHERE id = _issue_id FOR UPDATE;
 IF i.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, i.organization_id) THEN RAISE EXCEPTION 'Нет доступа к выдаче' USING ERRCODE='42501'; END IF;
 SELECT id INTO v_id FROM public.warehouse_issue_returns WHERE organization_id = i.organization_id AND operation_key = _operation_key;
 IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'already', true); END IF;
 IF _condition NOT IN ('good','damaged') OR _condition IS NULL THEN RAISE EXCEPTION 'Укажите состояние: исправно или повреждено'; END IF;
 IF _quantity IS NULL OR _quantity <= 0 OR _quantity::text IN ('NaN','Infinity') THEN RAISE EXCEPTION 'Количество должно быть больше нуля'; END IF;
 v_free := i.issued_qty - i.returned_qty - i.installed_qty - i.consumed_qty;
 IF _quantity > v_free THEN RAISE EXCEPTION 'Больше числящегося: доступно %', v_free; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id = _warehouse_id AND organization_id = i.organization_id) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouses WHERE id = _warehouse_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Склад в архиве: новые движения запрещены'; END IF;
 IF _condition = 'good' THEN
  INSERT INTO public.warehouse_documents(organization_id, doc_type, recipient_name, operation_key, operation_date, created_by, comment) VALUES (i.organization_id, 'return', i.recipient_name, _operation_key, current_date, v_actor, NULLIF(btrim(_note),'')) RETURNING id INTO v_doc;
  INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, to_warehouse_id, issue_id) VALUES (i.organization_id, v_doc, i.unit_id, _quantity, _warehouse_id, i.id);
  PERFORM public.post_warehouse_document(v_doc);
 ELSE
  UPDATE public.warehouse_issues SET returned_qty = returned_qty + _quantity WHERE id = i.id;
  INSERT INTO public.warehouse_damaged_balances(organization_id, unit_id, warehouse_id, quantity) VALUES (i.organization_id, i.unit_id, _warehouse_id, _quantity)
   ON CONFLICT (unit_id, warehouse_id) DO UPDATE SET quantity = warehouse_damaged_balances.quantity + EXCLUDED.quantity, updated_at = now();
 END IF;
 INSERT INTO public.warehouse_issue_returns(organization_id, issue_id, quantity, warehouse_id, condition, document_id, note, operation_key, created_by)
  VALUES (i.organization_id, i.id, _quantity, _warehouse_id, _condition, v_doc, NULLIF(btrim(_note),''), _operation_key, v_actor) RETURNING id INTO v_id;
 RETURN jsonb_build_object('id', v_id, 'document_id', v_doc, 'already', false);
END $$;

-- Linked reversal with mandatory reason; never deletes journal rows, never drives stock negative.
CREATE OR REPLACE FUNCTION public.warehouse_reverse_operation(_operation_key uuid, _kind text, _id uuid, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid := auth.uid(); us public.warehouse_issue_usages; rt public.warehouse_issue_returns; i public.warehouse_issues; v_id uuid; v_doc uuid; v_line uuid; v_dmg numeric; b record; v_left numeric; v_part numeric;
BEGIN
 IF _operation_key IS NULL THEN RAISE EXCEPTION 'Не указан ключ операции'; END IF;
 IF length(COALESCE(btrim(_reason),'')) < 3 THEN RAISE EXCEPTION 'Укажите причину исправления'; END IF;
 IF _kind = 'usage' THEN
  SELECT * INTO us FROM public.warehouse_issue_usages WHERE id = _id;
  IF us.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, us.organization_id) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
  SELECT * INTO i FROM public.warehouse_issues WHERE id = us.issue_id FOR UPDATE;
  SELECT id INTO v_id FROM public.warehouse_issue_usages WHERE organization_id = us.organization_id AND operation_key = _operation_key;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'already', true); END IF;
  IF us.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Исправление нельзя исправлять повторно'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_issue_usages WHERE reversal_of = us.id) THEN RAISE EXCEPTION 'Операция уже исправлена'; END IF;
  INSERT INTO public.warehouse_issue_usages(organization_id, issue_id, kind, quantity, equipment_id, operation_date, reversal_of, reason, operation_key, created_by)
   VALUES (us.organization_id, us.issue_id, us.kind, us.quantity, us.equipment_id, current_date, us.id, btrim(_reason), _operation_key, v_actor) RETURNING id INTO v_id;
  UPDATE public.warehouse_issues SET installed_qty = installed_qty - CASE WHEN us.kind='install' THEN us.quantity ELSE 0 END, consumed_qty = consumed_qty - CASE WHEN us.kind='consume' THEN us.quantity ELSE 0 END WHERE id = i.id;
  RETURN jsonb_build_object('id', v_id, 'already', false);
 ELSIF _kind = 'return' THEN
  SELECT * INTO rt FROM public.warehouse_issue_returns WHERE id = _id;
  IF rt.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, rt.organization_id) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
  SELECT * INTO i FROM public.warehouse_issues WHERE id = rt.issue_id FOR UPDATE;
  SELECT id INTO v_id FROM public.warehouse_issue_returns WHERE organization_id = rt.organization_id AND operation_key = _operation_key;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'already', true); END IF;
  IF rt.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Исправление нельзя исправлять повторно'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_issue_returns WHERE reversal_of = rt.id) THEN RAISE EXCEPTION 'Операция уже исправлена'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouses WHERE id = rt.warehouse_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Склад в архиве: новые движения запрещены'; END IF;
  IF rt.condition = 'good' THEN
   INSERT INTO public.warehouse_documents(organization_id, doc_type, operation_key, operation_date, created_by, comment) VALUES (rt.organization_id, 'correction', _operation_key, current_date, v_actor, 'Исправление возврата: ' || btrim(_reason)) RETURNING id INTO v_doc;
   v_left := rt.quantity;
   FOR b IN SELECT * FROM public.warehouse_balances WHERE unit_id = i.unit_id AND warehouse_id = rt.warehouse_id AND quantity > 0 ORDER BY (cell_id IS NOT NULL), id FOR UPDATE LOOP
    EXIT WHEN v_left <= 0; v_part := least(v_left, b.quantity);
    INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, from_warehouse_id, from_cell_id, issue_id) VALUES (rt.organization_id, v_doc, i.unit_id, v_part, rt.warehouse_id, b.cell_id, i.id) RETURNING id INTO v_line;
    PERFORM public.warehouse_apply_delta(rt.organization_id, v_doc, v_line, i.unit_id, rt.warehouse_id, b.cell_id, -v_part, 'return_reversal', v_actor);
    v_left := v_left - v_part;
   END LOOP;
   IF v_left > 0 THEN RAISE EXCEPTION 'Возвращённое уже перемещено или выдано: сначала исправьте последующие движения'; END IF;
   UPDATE public.warehouse_documents SET status = 'posted', posted_at = now(), posted_by = v_actor, number = public.warehouse_next_number(rt.organization_id) WHERE id = v_doc;
  ELSE
   SELECT quantity INTO v_dmg FROM public.warehouse_damaged_balances WHERE unit_id = i.unit_id AND warehouse_id = rt.warehouse_id FOR UPDATE;
   IF COALESCE(v_dmg,0) < rt.quantity THEN RAISE EXCEPTION 'Повреждённый остаток уже изменён: исправление невозможно'; END IF;
   UPDATE public.warehouse_damaged_balances SET quantity = quantity - rt.quantity, updated_at = now() WHERE unit_id = i.unit_id AND warehouse_id = rt.warehouse_id;
  END IF;
  UPDATE public.warehouse_issues SET returned_qty = returned_qty - rt.quantity WHERE id = i.id;
  INSERT INTO public.warehouse_issue_returns(organization_id, issue_id, quantity, warehouse_id, condition, document_id, reversal_of, reason, operation_key, created_by)
   VALUES (rt.organization_id, rt.issue_id, rt.quantity, rt.warehouse_id, rt.condition, v_doc, rt.id, btrim(_reason), _operation_key, v_actor) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'document_id', v_doc, 'already', false);
 END IF;
 RAISE EXCEPTION 'Недопустимая операция';
END $$;

-- 7. Inventory ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_warehouse_inventory(_warehouse_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.warehouses; v_actor uuid := auth.uid(); v_id uuid;
BEGIN
 SELECT * INTO w FROM public.warehouses WHERE id = _warehouse_id FOR UPDATE;
 IF w.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, w.organization_id) THEN RAISE EXCEPTION 'Нет доступа к складу' USING ERRCODE='42501'; END IF;
 IF w.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Склад в архиве'; END IF;
 SELECT id INTO v_id FROM public.warehouse_inventories WHERE warehouse_id = w.id AND status = 'draft';
 IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'already', true); END IF;
 PERFORM 1 FROM public.warehouse_balances WHERE warehouse_id = w.id FOR SHARE;
 INSERT INTO public.warehouse_inventories(organization_id, warehouse_id, snapshot_ledger_id, created_by)
  VALUES (w.organization_id, w.id, COALESCE((SELECT max(id) FROM public.warehouse_ledger WHERE warehouse_id = w.id), 0), v_actor) RETURNING id INTO v_id;
 INSERT INTO public.warehouse_inventory_lines(organization_id, inventory_id, unit_id, expected_qty)
  SELECT w.organization_id, v_id, unit_id, sum(quantity) FROM public.warehouse_balances WHERE warehouse_id = w.id GROUP BY unit_id HAVING sum(quantity) > 0;
 RETURN jsonb_build_object('id', v_id, 'already', false);
END $$;

CREATE OR REPLACE FUNCTION public.set_inventory_count(_inventory_id uuid, _unit_id uuid, _counted numeric, _reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.warehouse_inventories; v_actor uuid := auth.uid();
BEGIN
 SELECT * INTO inv FROM public.warehouse_inventories WHERE id = _inventory_id FOR UPDATE;
 IF inv.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, inv.organization_id) THEN RAISE EXCEPTION 'Нет доступа к инвентаризации' USING ERRCODE='42501'; END IF;
 IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Инвентаризация уже завершена и не редактируется'; END IF;
 IF _counted IS NOT NULL AND (_counted < 0 OR _counted::text IN ('NaN','Infinity')) THEN RAISE EXCEPTION 'Количество не может быть отрицательным'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouse_units WHERE id = _unit_id AND organization_id = inv.organization_id) THEN RAISE EXCEPTION 'ТМЦ другой организации' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_units WHERE id = _unit_id AND kind = 'item') AND _counted IS NOT NULL AND _counted NOT IN (0,1) THEN RAISE EXCEPTION 'Изделие учитывается поштучно: 0 или 1'; END IF;
 INSERT INTO public.warehouse_inventory_lines(organization_id, inventory_id, unit_id, expected_qty, counted_qty, reason, counted_by, counted_at)
  VALUES (inv.organization_id, inv.id, _unit_id, 0, _counted, NULLIF(btrim(_reason),''), CASE WHEN _counted IS NOT NULL THEN v_actor END, CASE WHEN _counted IS NOT NULL THEN now() END)
  ON CONFLICT (inventory_id, unit_id) DO UPDATE SET counted_qty = EXCLUDED.counted_qty, reason = EXCLUDED.reason, counted_by = EXCLUDED.counted_by, counted_at = EXCLUDED.counted_at;
 RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.refresh_warehouse_inventory(_inventory_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.warehouse_inventories; v_actor uuid := auth.uid(); v_reset int;
BEGIN
 SELECT * INTO inv FROM public.warehouse_inventories WHERE id = _inventory_id FOR UPDATE;
 IF inv.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, inv.organization_id) THEN RAISE EXCEPTION 'Нет доступа к инвентаризации' USING ERRCODE='42501'; END IF;
 IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Инвентаризация уже завершена и не редактируется'; END IF;
 PERFORM 1 FROM public.warehouse_balances WHERE warehouse_id = inv.warehouse_id FOR SHARE;
 WITH cur AS (SELECT unit_id, sum(quantity) q FROM public.warehouse_balances WHERE warehouse_id = inv.warehouse_id GROUP BY unit_id)
 INSERT INTO public.warehouse_inventory_lines(organization_id, inventory_id, unit_id, expected_qty)
  SELECT inv.organization_id, inv.id, unit_id, q FROM cur WHERE q > 0 ON CONFLICT (inventory_id, unit_id) DO NOTHING;
 WITH cur AS (SELECT unit_id, sum(quantity) q FROM public.warehouse_balances WHERE warehouse_id = inv.warehouse_id GROUP BY unit_id),
 upd AS (UPDATE public.warehouse_inventory_lines l SET expected_qty = COALESCE(c.q,0), counted_qty = NULL, counted_by = NULL, counted_at = NULL
   FROM public.warehouse_inventory_lines l2 LEFT JOIN cur c ON c.unit_id = l2.unit_id
   WHERE l.id = l2.id AND l.inventory_id = inv.id AND l.expected_qty <> COALESCE(c.q,0) RETURNING 1)
 SELECT count(*) INTO v_reset FROM upd;
 UPDATE public.warehouse_inventories SET snapshot_ledger_id = COALESCE((SELECT max(id) FROM public.warehouse_ledger WHERE warehouse_id = inv.warehouse_id), 0), snapshot_at = now() WHERE id = inv.id;
 RETURN jsonb_build_object('recount', v_reset);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_warehouse_inventory(_inventory_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.warehouse_inventories;
BEGIN
 SELECT * INTO inv FROM public.warehouse_inventories WHERE id = _inventory_id FOR UPDATE;
 IF inv.id IS NULL OR NOT public.user_can_use_qr_warehouse(auth.uid(), inv.organization_id) THEN RAISE EXCEPTION 'Нет доступа к инвентаризации' USING ERRCODE='42501'; END IF;
 IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Инвентаризация уже завершена'; END IF;
 UPDATE public.warehouse_inventories SET status = 'cancelled' WHERE id = inv.id;
 RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.post_warehouse_inventory(_inventory_id uuid, _confirm boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.warehouse_inventories; v_actor uuid := auth.uid(); l record; b record; v_doc uuid; v_line uuid; v_diff numeric; v_left numeric; v_part numeric; v_cur numeric; v_n int := 0;
BEGIN
 SELECT * INTO inv FROM public.warehouse_inventories WHERE id = _inventory_id FOR UPDATE;
 IF inv.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, inv.organization_id) THEN RAISE EXCEPTION 'Нет доступа к инвентаризации' USING ERRCODE='42501'; END IF;
 IF inv.status = 'posted' THEN RETURN jsonb_build_object('id', inv.id, 'document_id', inv.document_id, 'already', true); END IF;
 IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Инвентаризация отменена'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouses WHERE id = inv.warehouse_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Склад в архиве'; END IF;
 PERFORM 1 FROM public.warehouse_balances WHERE warehouse_id = inv.warehouse_id ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.warehouse_ledger WHERE warehouse_id = inv.warehouse_id AND id > inv.snapshot_ledger_id) THEN RAISE EXCEPTION 'Остатки изменились после снимка: обновите снимок и пересчитайте' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouse_inventory_lines WHERE inventory_id = inv.id AND counted_qty IS NOT NULL) THEN RAISE EXCEPTION 'Нет просчитанных позиций'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_inventory_lines WHERE inventory_id = inv.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty AND COALESCE(btrim(reason),'') = '') THEN RAISE EXCEPTION 'Укажите причину каждого расхождения'; END IF;
 IF EXISTS(SELECT 1 FROM public.warehouse_inventory_lines WHERE inventory_id = inv.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AND NOT COALESCE(_confirm,false) THEN RAISE EXCEPTION 'Подтвердите корректировку расхождений'; END IF;
 FOR l IN SELECT * FROM public.warehouse_inventory_lines WHERE inventory_id = inv.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty ORDER BY unit_id LOOP
  SELECT COALESCE(sum(quantity),0) INTO v_cur FROM public.warehouse_balances WHERE unit_id = l.unit_id AND warehouse_id = inv.warehouse_id;
  IF v_cur <> l.expected_qty THEN RAISE EXCEPTION 'Остатки изменились после снимка: обновите снимок и пересчитайте' USING ERRCODE='40001'; END IF;
  IF v_doc IS NULL THEN INSERT INTO public.warehouse_documents(organization_id, doc_type, operation_date, created_by, comment) VALUES (inv.organization_id, 'inventory', current_date, v_actor, 'Инвентаризация') RETURNING id INTO v_doc; END IF;
  v_diff := l.counted_qty - l.expected_qty;
  IF v_diff > 0 THEN
   INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, to_warehouse_id) VALUES (inv.organization_id, v_doc, l.unit_id, v_diff, inv.warehouse_id) RETURNING id INTO v_line;
   PERFORM public.warehouse_apply_delta(inv.organization_id, v_doc, v_line, l.unit_id, inv.warehouse_id, NULL, v_diff, 'inventory', v_actor);
  ELSE
   v_left := -v_diff;
   FOR b IN SELECT * FROM public.warehouse_balances WHERE unit_id = l.unit_id AND warehouse_id = inv.warehouse_id AND quantity > 0 ORDER BY (cell_id IS NOT NULL), id LOOP
    EXIT WHEN v_left <= 0; v_part := least(v_left, b.quantity);
    INSERT INTO public.warehouse_document_lines(organization_id, document_id, unit_id, quantity, from_warehouse_id, from_cell_id) VALUES (inv.organization_id, v_doc, l.unit_id, v_part, inv.warehouse_id, b.cell_id) RETURNING id INTO v_line;
    PERFORM public.warehouse_apply_delta(inv.organization_id, v_doc, v_line, l.unit_id, inv.warehouse_id, b.cell_id, -v_part, 'inventory', v_actor);
    v_left := v_left - v_part;
   END LOOP;
  END IF;
  v_n := v_n + 1;
 END LOOP;
 IF v_doc IS NOT NULL THEN UPDATE public.warehouse_documents SET status = 'posted', posted_at = now(), posted_by = v_actor, number = public.warehouse_next_number(inv.organization_id) WHERE id = v_doc; END IF;
 UPDATE public.warehouse_inventories SET status = 'posted', posted_at = now(), posted_by = v_actor, document_id = v_doc WHERE id = inv.id;
 RETURN jsonb_build_object('id', inv.id, 'document_id', v_doc, 'adjusted', v_n, 'already', false);
END $$;

REVOKE ALL ON FUNCTION public.receive_request_partial(uuid,uuid,uuid,uuid,jsonb,boolean), public.set_warehouse_archived(uuid,boolean), public.warehouse_issue(uuid,uuid,uuid,numeric,text,uuid,date,uuid,uuid,text), public.confirm_issue_received(uuid), public.warehouse_issue_usage(uuid,uuid,text,numeric,uuid,date,text), public.warehouse_return_issue(uuid,uuid,numeric,uuid,text,text), public.warehouse_reverse_operation(uuid,text,uuid,text), public.start_warehouse_inventory(uuid), public.set_inventory_count(uuid,uuid,numeric,text), public.refresh_warehouse_inventory(uuid), public.cancel_warehouse_inventory(uuid), public.post_warehouse_inventory(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_request_partial(uuid,uuid,uuid,uuid,jsonb,boolean), public.set_warehouse_archived(uuid,boolean), public.warehouse_issue(uuid,uuid,uuid,numeric,text,uuid,date,uuid,uuid,text), public.confirm_issue_received(uuid), public.warehouse_issue_usage(uuid,uuid,text,numeric,uuid,date,text), public.warehouse_return_issue(uuid,uuid,numeric,uuid,text,text), public.warehouse_reverse_operation(uuid,text,uuid,text), public.start_warehouse_inventory(uuid), public.set_inventory_count(uuid,uuid,numeric,text), public.refresh_warehouse_inventory(uuid), public.cancel_warehouse_inventory(uuid), public.post_warehouse_inventory(uuid,boolean) TO authenticated;
