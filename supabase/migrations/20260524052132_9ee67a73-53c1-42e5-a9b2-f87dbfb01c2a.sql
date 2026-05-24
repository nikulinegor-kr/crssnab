
CREATE TABLE public.telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  group_id text NOT NULL,
  notification_type text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  is_discovered boolean NOT NULL DEFAULT false,
  chat_type text,
  last_message_at timestamptz,
  last_api_status integer,
  last_api_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, group_id, notification_type)
);

CREATE UNIQUE INDEX telegram_groups_group_id_unique_when_unassigned
  ON public.telegram_groups (group_id) WHERE organization_id IS NULL;

CREATE INDEX idx_telegram_groups_org ON public.telegram_groups (organization_id);
CREATE INDEX idx_telegram_groups_type ON public.telegram_groups (organization_id, notification_type) WHERE is_active = true;

ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view telegram groups"
  ON public.telegram_groups FOR SELECT TO authenticated
  USING (organization_id IS NULL OR user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can insert telegram groups"
  ON public.telegram_groups FOR INSERT TO authenticated
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update telegram groups"
  ON public.telegram_groups FOR UPDATE TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can claim discovered telegram groups"
  ON public.telegram_groups FOR UPDATE TO authenticated
  USING (organization_id IS NULL)
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete telegram groups"
  ON public.telegram_groups FOR DELETE TO authenticated
  USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Authenticated can delete discovered telegram groups"
  ON public.telegram_groups FOR DELETE TO authenticated
  USING (organization_id IS NULL);

CREATE TRIGGER update_telegram_groups_updated_at
  BEFORE UPDATE ON public.telegram_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.telegram_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  group_id text,
  chat_id text,
  group_name text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_webhook_logs_created_at ON public.telegram_webhook_logs (created_at DESC);
CREATE INDEX idx_telegram_webhook_logs_chat_id ON public.telegram_webhook_logs (chat_id);

ALTER TABLE public.telegram_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view telegram webhook logs"
  ON public.telegram_webhook_logs FOR SELECT TO authenticated
  USING (
    group_id IN (
      SELECT tg.group_id FROM public.telegram_groups tg
      WHERE user_is_org_admin(auth.uid(), tg.organization_id)
    )
  );
