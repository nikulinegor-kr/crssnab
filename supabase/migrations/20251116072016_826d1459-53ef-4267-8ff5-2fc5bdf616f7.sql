-- Create table for custom request statuses
CREATE TABLE public.request_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create table for custom request priorities
CREATE TABLE public.request_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for request_statuses
CREATE POLICY "Users can view org statuses"
  ON public.request_statuses FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage statuses"
  ON public.request_statuses FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- RLS Policies for request_priorities
CREATE POLICY "Users can view org priorities"
  ON public.request_priorities FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can manage priorities"
  ON public.request_priorities FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view org audit logs"
  ON public.audit_logs FOR SELECT
  USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_request_statuses_updated_at
  BEFORE UPDATE ON public.request_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_request_priorities_updated_at
  BEFORE UPDATE ON public.request_priorities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _organization_id UUID,
  _action TEXT,
  _entity_type TEXT,
  _entity_id TEXT DEFAULT NULL,
  _old_values JSONB DEFAULT NULL,
  _new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    _organization_id,
    auth.uid(),
    _action,
    _entity_type,
    _entity_id,
    _old_values,
    _new_values
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;