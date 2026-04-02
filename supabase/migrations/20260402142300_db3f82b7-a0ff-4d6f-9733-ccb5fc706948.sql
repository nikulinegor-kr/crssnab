
-- Members need to read org name, branding etc. Tokens are now in telegram_settings.
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT
USING (user_has_org_access(auth.uid(), id));

-- Drop the admin-only policy since the member policy is more inclusive
DROP POLICY IF EXISTS "Admins can view full organizations" ON public.organizations;
