-- Create enum for user roles within organizations
CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'member');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create user_organizations junction table (many-to-many)
CREATE TABLE public.user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role organization_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS on user_organizations
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Add organization_id to requests table
ALTER TABLE public.requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_requests_organization ON public.requests(organization_id);
CREATE INDEX idx_user_organizations_user ON public.user_organizations(user_id);
CREATE INDEX idx_user_organizations_org ON public.user_organizations(organization_id);

-- Security definer function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_has_org_access(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Security definer function to check if user has specific role in organization
CREATE OR REPLACE FUNCTION public.user_has_org_role(_user_id UUID, _org_id UUID, _role organization_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is owner or admin
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;

-- RLS Policies for organizations table
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  USING (public.user_has_org_access(auth.uid(), id));

CREATE POLICY "Owners and admins can update their organizations"
  ON public.organizations FOR UPDATE
  USING (public.user_is_org_admin(auth.uid(), id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for user_organizations table
CREATE POLICY "Users can view their organization memberships"
  ON public.user_organizations FOR SELECT
  USING (user_id = auth.uid() OR public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can add members"
  ON public.user_organizations FOR INSERT
  WITH CHECK (public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can update members"
  ON public.user_organizations FOR UPDATE
  USING (public.user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can remove members"
  ON public.user_organizations FOR DELETE
  USING (public.user_is_org_admin(auth.uid(), organization_id));

-- Update RLS policies for requests table to use organizations
DROP POLICY IF EXISTS "Users can view their own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can delete their own requests" ON public.requests;

CREATE POLICY "Users can view organization requests"
  ON public.requests FOR SELECT
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create organization requests"
  ON public.requests FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND public.user_has_org_access(auth.uid(), organization_id)
  );

CREATE POLICY "Users can update organization requests"
  ON public.requests FOR UPDATE
  USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete organization requests"
  ON public.requests FOR DELETE
  USING (public.user_is_org_admin(auth.uid(), organization_id));

-- Update handle_new_user function to create organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, organization_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация')
  );
  
  -- Create organization
  org_name := COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация');
  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;
  
  -- Add user as owner of the organization
  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (new.id, new_org_id, 'owner');
  
  RETURN new;
END;
$$;

-- Add trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();