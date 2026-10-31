-- Адресный склад с QR: ячейки, учётные единицы (изделия/партии), документы, остатки, выдачи, журнал.
CREATE TABLE public.warehouse_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  qr_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE public.warehouse_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('item','batch')),
  product_id uuid REFERENCES public.warehouse_products(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  serial_number text,
  batch_number text,
  unit text NOT NULL DEFAULT 'шт',
  qr_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_units_org_idx ON public.warehouse_units(organization_id, created_at DESC);

CREATE TABLE public.warehouse_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('receipt','move','issue','return')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  number text,
  recipient_name text,
  recipient_user_id uuid,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  comment text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_by uuid,
  posted_at timestamptz
);
CREATE INDEX warehouse_documents_org_idx ON public.warehouse_documents(organization_id, created_at DESC);

CREATE TABLE public.warehouse_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.warehouse_documents(id),
  unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  cell_id uuid REFERENCES public.warehouse_cells(id),
  recipient_name text NOT NULL,
  recipient_user_id uuid,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  issued_qty numeric NOT NULL CHECK (issued_qty > 0),
  returned_qty numeric NOT NULL DEFAULT 0 CHECK (returned_qty >= 0 AND returned_qty <= issued_qty),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_issues_unit_idx ON public.warehouse_issues(unit_id);

CREATE TABLE public.warehouse_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.warehouse_documents(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  from_warehouse_id uuid REFERENCES public.warehouses(id),
  from_cell_id uuid REFERENCES public.warehouse_cells(id),
  to_warehouse_id uuid REFERENCES public.warehouses(id),
  to_cell_id uuid REFERENCES public.warehouse_cells(id),
  issue_id uuid REFERENCES public.warehouse_issues(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_document_lines_doc_idx ON public.warehouse_document_lines(document_id);

CREATE TABLE public.warehouse_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  cell_id uuid REFERENCES public.warehouse_cells(id),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX warehouse_balances_place_uidx ON public.warehouse_balances(unit_id, warehouse_id, (COALESCE(cell_id,'00000000-0000-0000-0000-000000000000'::uuid)));
CREATE INDEX warehouse_balances_org_idx ON public.warehouse_balances(organization_id, warehouse_id);

CREATE TABLE public.warehouse_ledger (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.warehouse_documents(id),
  line_id uuid REFERENCES public.warehouse_document_lines(id),
  unit_id uuid NOT NULL REFERENCES public.warehouse_units(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  cell_id uuid REFERENCES public.warehouse_cells(id),
  operation text NOT NULL,
  delta numeric NOT NULL,
  balance_after numeric NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_ledger_unit_idx ON public.warehouse_ledger(unit_id, created_at DESC);
CREATE INDEX warehouse_ledger_org_idx ON public.warehouse_ledger(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.warehouse_cells, public.warehouse_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_documents, public.warehouse_document_lines TO authenticated;
GRANT SELECT ON public.warehouse_balances, public.warehouse_ledger, public.warehouse_issues TO authenticated;
GRANT ALL ON public.warehouse_cells, public.warehouse_units, public.warehouse_documents, public.warehouse_document_lines, public.warehouse_balances, public.warehouse_ledger, public.warehouse_issues TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.warehouse_ledger_id_seq TO service_role;

ALTER TABLE public.warehouse_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_issues ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_use_qr_warehouse(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_permission(_user, _org, 'erp.warehouse')
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_use_qr_warehouse(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_use_qr_warehouse(uuid, uuid) TO authenticated, service_role;

CREATE POLICY wh_cells_select ON public.warehouse_cells FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_cells_insert ON public.warehouse_cells FOR INSERT TO authenticated WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = warehouse_id AND w.organization_id = warehouse_cells.organization_id));
CREATE POLICY wh_cells_update ON public.warehouse_cells FOR UPDATE TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id)) WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id));

CREATE POLICY wh_units_select ON public.warehouse_units FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_units_insert ON public.warehouse_units FOR INSERT TO authenticated WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.warehouse_products p WHERE p.id = product_id AND p.organization_id = warehouse_units.organization_id)));
CREATE POLICY wh_units_update ON public.warehouse_units FOR UPDATE TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id)) WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id));

CREATE POLICY wh_docs_select ON public.warehouse_documents FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_docs_insert ON public.warehouse_documents FOR INSERT TO authenticated WITH CHECK (status = 'draft' AND posted_at IS NULL AND public.user_can_use_qr_warehouse(auth.uid(), organization_id));
CREATE POLICY wh_docs_update ON public.warehouse_documents FOR UPDATE TO authenticated USING (status = 'draft' AND public.user_can_use_qr_warehouse(auth.uid(), organization_id)) WITH CHECK (status = 'draft' AND posted_at IS NULL AND public.user_can_use_qr_warehouse(auth.uid(), organization_id));
CREATE POLICY wh_docs_delete ON public.warehouse_documents FOR DELETE TO authenticated USING (status = 'draft' AND public.user_can_use_qr_warehouse(auth.uid(), organization_id));

CREATE POLICY wh_lines_select ON public.warehouse_document_lines FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_lines_insert ON public.warehouse_document_lines FOR INSERT TO authenticated WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.warehouse_documents d WHERE d.id = document_id AND d.organization_id = warehouse_document_lines.organization_id AND d.status = 'draft'));
CREATE POLICY wh_lines_update ON public.warehouse_document_lines FOR UPDATE TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.warehouse_documents d WHERE d.id = document_id AND d.status = 'draft')) WITH CHECK (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.warehouse_documents d WHERE d.id = document_id AND d.organization_id = warehouse_document_lines.organization_id AND d.status = 'draft'));
CREATE POLICY wh_lines_delete ON public.warehouse_document_lines FOR DELETE TO authenticated USING (public.user_can_use_qr_warehouse(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.warehouse_documents d WHERE d.id = document_id AND d.status = 'draft'));

CREATE POLICY wh_balances_select ON public.warehouse_balances FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_ledger_select ON public.warehouse_ledger FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));
CREATE POLICY wh_issues_select ON public.warehouse_issues FOR SELECT TO authenticated USING (public.user_has_org_access(auth.uid(), organization_id));

-- QR-токены постоянные: повторная печать всегда даёт тот же код.
CREATE OR REPLACE FUNCTION public.warehouse_keep_qr_token()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.qr_token := OLD.qr_token;
  NEW.organization_id := OLD.organization_id;
  IF TG_TABLE_NAME = 'warehouse_units' THEN NEW.kind := OLD.kind; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER warehouse_cells_keep_qr BEFORE UPDATE ON public.warehouse_cells FOR EACH ROW EXECUTE FUNCTION public.warehouse_keep_qr_token();
CREATE TRIGGER warehouse_units_keep_qr BEFORE UPDATE ON public.warehouse_units FOR EACH ROW EXECUTE FUNCTION public.warehouse_keep_qr_token();

CREATE OR REPLACE FUNCTION public.warehouse_apply_delta(_org uuid, _doc uuid, _line uuid, _unit uuid, _wh uuid, _cell uuid, _delta numeric, _op text, _actor uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_qty numeric;
BEGIN
  IF _wh IS NULL THEN RAISE EXCEPTION 'Не указан склад' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = _wh AND organization_id = _org) THEN RAISE EXCEPTION 'Склад другой организации' USING ERRCODE = '42501'; END IF;
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
END $$;
REVOKE EXECUTE ON FUNCTION public.warehouse_apply_delta(uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_warehouse_document(_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d warehouse_documents; l record; u warehouse_units; i warehouse_issues; v_actor uuid := auth.uid(); v_total numeric; v_seq int; v_count int := 0;
BEGIN
  SELECT * INTO d FROM warehouse_documents WHERE id = _document_id FOR UPDATE;
  IF d.id IS NULL OR NOT public.user_can_use_qr_warehouse(v_actor, d.organization_id) THEN
    RAISE EXCEPTION 'Нет доступа к документу' USING ERRCODE = '42501'; END IF;
  IF d.status = 'posted' THEN
    RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', true);
  END IF;
  IF d.doc_type = 'issue' AND (COALESCE(btrim(d.recipient_name), '') = '' OR (d.request_id IS NULL AND d.object_id IS NULL)) THEN
    RAISE EXCEPTION 'Для выдачи укажите получателя и заявку или объект' USING ERRCODE = 'P0001'; END IF;
  IF d.request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM requests WHERE id = d.request_id AND organization_id = d.organization_id) THEN
    RAISE EXCEPTION 'Заявка другой организации' USING ERRCODE = '42501'; END IF;
  IF d.object_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_objects WHERE id = d.object_id AND organization_id = d.organization_id) THEN
    RAISE EXCEPTION 'Объект другой организации' USING ERRCODE = '42501'; END IF;

  -- Блокировки по единицам в стабильном порядке: исключают гонки и взаимоблокировки.
  PERFORM 1 FROM warehouse_units WHERE id IN (SELECT unit_id FROM warehouse_document_lines WHERE document_id = d.id) ORDER BY id FOR UPDATE;

  FOR l IN SELECT * FROM warehouse_document_lines WHERE document_id = d.id ORDER BY unit_id, created_at, id LOOP
    v_count := v_count + 1;
    SELECT * INTO u FROM warehouse_units WHERE id = l.unit_id;
    IF u.organization_id <> d.organization_id OR l.organization_id <> d.organization_id THEN
      RAISE EXCEPTION 'Позиция другой организации' USING ERRCODE = '42501'; END IF;
    IF u.kind = 'item' AND l.quantity <> 1 THEN
      RAISE EXCEPTION 'Изделие «%» учитывается поштучно: количество 1', u.name USING ERRCODE = 'P0001'; END IF;
    IF d.doc_type = 'receipt' THEN
      IF u.kind = 'item' THEN
        SELECT COALESCE(sum(quantity), 0) INTO v_total FROM warehouse_balances WHERE unit_id = u.id;
        IF v_total > 0 OR EXISTS (SELECT 1 FROM warehouse_issues WHERE unit_id = u.id AND returned_qty < issued_qty) THEN
          RAISE EXCEPTION 'Изделие «%» уже числится на складе или выдано', u.name USING ERRCODE = 'P0001'; END IF;
      END IF;
      PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.to_warehouse_id, l.to_cell_id, l.quantity, 'receipt', v_actor);
    ELSIF d.doc_type = 'move' THEN
      IF l.from_warehouse_id = l.to_warehouse_id AND l.from_cell_id IS NOT DISTINCT FROM l.to_cell_id THEN
        RAISE EXCEPTION 'Место отправления и назначения совпадают' USING ERRCODE = 'P0001'; END IF;
      PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.from_warehouse_id, l.from_cell_id, -l.quantity, 'move_out', v_actor);
      PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.to_warehouse_id, l.to_cell_id, l.quantity, 'move_in', v_actor);
    ELSIF d.doc_type = 'issue' THEN
      PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, l.from_warehouse_id, l.from_cell_id, -l.quantity, 'issue', v_actor);
      INSERT INTO warehouse_issues(organization_id, document_id, unit_id, warehouse_id, cell_id, recipient_name, recipient_user_id, request_id, object_id, issued_qty)
      VALUES (d.organization_id, d.id, u.id, l.from_warehouse_id, l.from_cell_id, btrim(d.recipient_name), d.recipient_user_id, d.request_id, d.object_id, l.quantity);
    ELSE
      SELECT * INTO i FROM warehouse_issues WHERE id = l.issue_id FOR UPDATE;
      IF i.id IS NULL OR i.organization_id <> d.organization_id OR i.unit_id <> u.id THEN
        RAISE EXCEPTION 'Возврат должен ссылаться на выдачу этой позиции' USING ERRCODE = 'P0001'; END IF;
      IF i.returned_qty + l.quantity > i.issued_qty THEN
        RAISE EXCEPTION 'Возврат больше выданного: выдано %, уже возвращено %', i.issued_qty, i.returned_qty USING ERRCODE = 'P0001'; END IF;
      UPDATE warehouse_issues SET returned_qty = returned_qty + l.quantity WHERE id = i.id;
      PERFORM warehouse_apply_delta(d.organization_id, d.id, l.id, u.id, COALESCE(l.to_warehouse_id, i.warehouse_id),
        CASE WHEN l.to_warehouse_id IS NULL THEN i.cell_id ELSE l.to_cell_id END, l.quantity, 'return', v_actor);
    END IF;
  END LOOP;
  IF v_count = 0 THEN RAISE EXCEPTION 'В документе нет позиций' USING ERRCODE = 'P0001'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('warehouse_doc_number:' || d.organization_id::text, 0));
  SELECT COALESCE(max(split_part(number, '-', 3)::int), 0) + 1 INTO v_seq FROM warehouse_documents
   WHERE organization_id = d.organization_id AND number LIKE 'СК-' || to_char(now(), 'YYYY') || '-%';
  UPDATE warehouse_documents SET status = 'posted', posted_at = now(), posted_by = v_actor,
    number = 'СК-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0')
  WHERE id = d.id RETURNING * INTO d;
  RETURN jsonb_build_object('id', d.id, 'number', d.number, 'already_posted', false);
END $$;
REVOKE EXECUTE ON FUNCTION public.post_warehouse_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_warehouse_document(uuid) TO authenticated, service_role;
