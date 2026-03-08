
CREATE TABLE public.request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  article text,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org request items" ON public.request_items
  FOR SELECT USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org request items" ON public.request_items
  FOR INSERT WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org request items" ON public.request_items
  FOR UPDATE USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org request items" ON public.request_items
  FOR DELETE USING (user_has_org_access(auth.uid(), organization_id));
