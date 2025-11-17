-- Fix 1: Remove unrestricted file upload policies
DROP POLICY IF EXISTS "Anyone can upload request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload request documents" ON storage.objects;

-- Fix 2: Remove overly permissive request update policy
DROP POLICY IF EXISTS "Authenticated users can update requests" ON public.requests;

-- Fix 3: Restrict organization data access to admins only (for telegram tokens)
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- Create new policy: only admins/owners can view full organization data including tokens
CREATE POLICY "Admins can view full organization data"
  ON public.organizations
  FOR SELECT
  USING (user_is_org_admin(auth.uid(), id));

-- Create safe view for non-admin members to view basic org info
CREATE OR REPLACE VIEW public.organizations_safe AS
SELECT 
  id, name, description, logo_url, primary_color, secondary_color,
  contact_email, contact_phone, created_at, updated_at,
  telegram_auto_send_on_create, telegram_auto_send_on_status_change
FROM public.organizations;

-- Grant access to the safe view
GRANT SELECT ON public.organizations_safe TO authenticated;

-- Verify fixes
SELECT 'Storage policies check:' as check_type, count(*) as policy_count 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%Anyone%'
UNION ALL
SELECT 'Requests UPDATE policies check:', count(*) 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'requests' AND cmd = 'UPDATE' AND policyname = 'Authenticated users can update requests';