
-- Table for storing per-user permissions
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins/owners can manage permissions in their org
CREATE POLICY "Admins can manage permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.user_is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));

-- Users can read their own permissions
CREATE POLICY "Users can read own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Security definer function to check permission without recursion
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _org_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins/owners always have all permissions
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner', 'admin')
    ) THEN true
    ELSE COALESCE(
      (SELECT allowed FROM public.user_permissions
       WHERE user_id = _user_id AND organization_id = _org_id AND permission_key = _permission_key),
      false
    )
  END
$$;

-- Updated_at trigger
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
