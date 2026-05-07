
CREATE TABLE public.client_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  organization_id UUID,
  severity TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  context JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_client_error_logs_created_at ON public.client_error_logs(created_at DESC);
CREATE INDEX idx_client_error_logs_org ON public.client_error_logs(organization_id);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert error logs"
ON public.client_error_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Org admins can view their error logs"
ON public.client_error_logs
FOR SELECT
USING (
  organization_id IS NOT NULL
  AND public.user_is_org_admin(auth.uid(), organization_id)
);
