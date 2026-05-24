CREATE TABLE public.max_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT,
  group_id TEXT,
  chat_id TEXT,
  group_name TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.max_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view max webhook logs"
ON public.max_webhook_logs
FOR SELECT
USING (
  group_id IN (
    SELECT mg.group_id FROM public.max_groups mg
    WHERE public.user_is_org_admin(auth.uid(), mg.organization_id)
  )
);

CREATE INDEX idx_max_webhook_logs_created_at ON public.max_webhook_logs (created_at DESC);
CREATE INDEX idx_max_webhook_logs_chat_id ON public.max_webhook_logs (chat_id);