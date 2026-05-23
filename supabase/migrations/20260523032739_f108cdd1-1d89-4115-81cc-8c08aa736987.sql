
CREATE TABLE public.supplier_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  object_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_lists_object ON public.supplier_lists(object_id);
CREATE INDEX idx_supplier_lists_org ON public.supplier_lists(organization_id);

CREATE TABLE public.supplier_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.supplier_lists(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  website_url TEXT,
  supplier_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_list_items_list ON public.supplier_list_items(list_id);

ALTER TABLE public.supplier_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read supplier_lists" ON public.supplier_lists
  FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "org editors insert supplier_lists" ON public.supplier_lists
  FOR INSERT WITH CHECK (user_can_edit_requests(auth.uid(), organization_id));
CREATE POLICY "org editors update supplier_lists" ON public.supplier_lists
  FOR UPDATE USING (user_can_edit_requests(auth.uid(), organization_id));
CREATE POLICY "org editors delete supplier_lists" ON public.supplier_lists
  FOR DELETE USING (user_can_edit_requests(auth.uid(), organization_id));

CREATE POLICY "org members read supplier_list_items" ON public.supplier_list_items
  FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));
CREATE POLICY "org editors insert supplier_list_items" ON public.supplier_list_items
  FOR INSERT WITH CHECK (user_can_edit_requests(auth.uid(), organization_id));
CREATE POLICY "org editors update supplier_list_items" ON public.supplier_list_items
  FOR UPDATE USING (user_can_edit_requests(auth.uid(), organization_id));
CREATE POLICY "org editors delete supplier_list_items" ON public.supplier_list_items
  FOR DELETE USING (user_can_edit_requests(auth.uid(), organization_id));

CREATE TRIGGER trg_supplier_lists_updated
  BEFORE UPDATE ON public.supplier_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supplier_list_items_updated
  BEFORE UPDATE ON public.supplier_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supplier_lists_created_by
  BEFORE INSERT ON public.supplier_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
