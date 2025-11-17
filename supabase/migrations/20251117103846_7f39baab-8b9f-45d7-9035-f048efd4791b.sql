-- Fix the RLS policy issue - restore the original policy but create a security definer function for safe access
-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Admins can view full organization data" ON public.organizations;

-- Restore the original policy that allows all members to view their organizations
CREATE POLICY "Users can view their organizations"
  ON public.organizations
  FOR SELECT
  USING (user_has_org_access(auth.uid(), id));

-- Drop the view since we'll use a function instead
DROP VIEW IF EXISTS public.organizations_safe;

-- Create a security definer function that returns organization data without sensitive fields
CREATE OR REPLACE FUNCTION public.get_organization_safe(_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  logo_url text,
  primary_color text,
  secondary_color text,
  contact_email text,
  contact_phone text,
  telegram_auto_send_on_create boolean,
  telegram_auto_send_on_status_change boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, name, description, logo_url, primary_color, secondary_color,
    contact_email, contact_phone, 
    telegram_auto_send_on_create, telegram_auto_send_on_status_change,
    created_at, updated_at
  FROM public.organizations
  WHERE id = _org_id
  AND user_has_org_access(auth.uid(), id);
$$;