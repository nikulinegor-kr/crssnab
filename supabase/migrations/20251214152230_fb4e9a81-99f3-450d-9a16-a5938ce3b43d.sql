-- Create clients table linked to auth users
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, organization_id)
);

-- Add client_id to requests table
ALTER TABLE public.requests ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients table
CREATE POLICY "Admins can manage clients"
ON public.clients FOR ALL
USING (user_is_org_admin(auth.uid(), organization_id))
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Clients can view their own record"
ON public.clients FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Org members can view clients"
ON public.clients FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

-- Function to check if user is a client
CREATE OR REPLACE FUNCTION public.is_client(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Function to get client's organization
CREATE OR REPLACE FUNCTION public.get_client_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.clients
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- Policy for clients to view their own requests
CREATE POLICY "Clients can view their requests"
ON public.requests FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

-- Policy for clients to add comments
CREATE POLICY "Clients can add comments to their requests"
ON public.request_comments FOR INSERT
WITH CHECK (
  request_id IN (
    SELECT r.id FROM public.requests r
    JOIN public.clients c ON r.client_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view comments on their requests"
ON public.request_comments FOR SELECT
USING (
  request_id IN (
    SELECT r.id FROM public.requests r
    JOIN public.clients c ON r.client_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Client invitations table
CREATE TABLE public.client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
ON public.client_invitations FOR ALL
USING (user_is_org_admin(auth.uid(), organization_id))
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Anyone can view invitation by token"
ON public.client_invitations FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();