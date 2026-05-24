
-- Таблица групп MAX-бота
CREATE TABLE IF NOT EXISTS public.max_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, group_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_max_groups_org ON public.max_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_max_groups_type ON public.max_groups(organization_id, notification_type) WHERE is_active = true;

ALTER TABLE public.max_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view max groups"
ON public.max_groups FOR SELECT TO authenticated
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can insert max groups"
ON public.max_groups FOR INSERT TO authenticated
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update max groups"
ON public.max_groups FOR UPDATE TO authenticated
USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete max groups"
ON public.max_groups FOR DELETE TO authenticated
USING (user_is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_max_groups_updated_at
BEFORE UPDATE ON public.max_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Таблица для дедупликации входящих апдейтов
CREATE TABLE IF NOT EXISTS public.max_updates (
  update_id BIGINT PRIMARY KEY,
  chat_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.max_updates ENABLE ROW LEVEL SECURITY;
-- Нет публичных политик: доступ только через service role
