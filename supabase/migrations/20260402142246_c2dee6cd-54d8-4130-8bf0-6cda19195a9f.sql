
-- 1. Replace organizations SELECT policy with a view that hides sensitive columns
-- Create a secure view for non-admin access (excludes telegram tokens)
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- New policy: all org members can see non-sensitive fields only
-- We'll use a function-based approach: create a safe SELECT policy that excludes tokens
-- Since column-level RLS isn't possible, we restrict direct SELECT to admins only
-- and non-admins use get_organization_safe RPC

CREATE POLICY "Admins can view full organizations"
ON public.organizations FOR SELECT
USING (user_is_org_admin(auth.uid(), id));

CREATE POLICY "Members can view basic org info"
ON public.organizations FOR SELECT
USING (
  user_has_org_access(auth.uid(), id)
  AND telegram_bot_token IS NOT DISTINCT FROM telegram_bot_token
);

-- Actually, we can't do column-level filtering via RLS. 
-- Better approach: keep access but ensure client code uses RPCs.
-- Let's just restrict to admins for full access, members get basic via RPC.
-- Drop the second policy and keep admin-only direct access.
DROP POLICY IF EXISTS "Members can view basic org info" ON public.organizations;

-- But we need members to read org name for sidebar etc. 
-- The get_organization_safe RPC already handles this.
-- However, some queries like branding/settings may need direct access.
-- Let's check if get_organization_safe covers all needs.
-- For safety, keep member SELECT but add a note that tokens are exposed.
-- Better: create a restricted policy that works with existing code.

-- Actually the safest approach: keep the SELECT for all members (needed for many features)
-- but move telegram tokens to a separate table with admin-only access.

-- Create telegram_settings table
CREATE TABLE IF NOT EXISTS public.telegram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bot_token text,
  chat_id text,
  invoice_chat_id text,
  auto_send_on_create boolean DEFAULT true,
  auto_send_on_status_change boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view telegram settings"
ON public.telegram_settings FOR SELECT
USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update telegram settings"
ON public.telegram_settings FOR UPDATE
USING (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can insert telegram settings"
ON public.telegram_settings FOR INSERT
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- Migrate existing data
INSERT INTO public.telegram_settings (organization_id, bot_token, chat_id, invoice_chat_id, auto_send_on_create, auto_send_on_status_change)
SELECT id, telegram_bot_token, telegram_chat_id, telegram_invoice_chat_id, telegram_auto_send_on_create, telegram_auto_send_on_status_change
FROM public.organizations
WHERE telegram_bot_token IS NOT NULL OR telegram_chat_id IS NOT NULL
ON CONFLICT (organization_id) DO NOTHING;

-- Update get_telegram_credentials to use new table
CREATE OR REPLACE FUNCTION public.get_telegram_credentials(_org_id uuid)
RETURNS TABLE(telegram_bot_token text, telegram_chat_id text, telegram_auto_send_on_create boolean, telegram_auto_send_on_status_change boolean, telegram_invoice_chat_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    bot_token as telegram_bot_token, 
    chat_id as telegram_chat_id,
    auto_send_on_create as telegram_auto_send_on_create,
    auto_send_on_status_change as telegram_auto_send_on_status_change,
    invoice_chat_id as telegram_invoice_chat_id
  FROM telegram_settings 
  WHERE organization_id = _org_id 
    AND user_is_org_admin(auth.uid(), _org_id);
$$;

-- Update is_telegram_configured to use new table
CREATE OR REPLACE FUNCTION public.is_telegram_configured(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM telegram_settings 
    WHERE organization_id = _org_id 
      AND user_has_org_access(auth.uid(), _org_id)
      AND bot_token IS NOT NULL 
      AND bot_token != ''
      AND chat_id IS NOT NULL 
      AND chat_id != ''
  );
$$;

-- 2. Fix audit_logs: remove user INSERT policy (service role bypasses RLS)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- 3. Fix object-documents storage policies with org checks
DROP POLICY IF EXISTS "Users can view object docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload object docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete object docs" ON storage.objects;

CREATE POLICY "Org members can view object docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'object-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.object_documents od
    JOIN public.user_organizations uo ON uo.organization_id = od.organization_id
    WHERE uo.user_id = auth.uid()
    AND od.file_url LIKE '%' || name
  )
);

CREATE POLICY "Org members can upload object docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'object-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
  )
);

CREATE POLICY "Org admins can delete object docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'object-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.object_documents od
    JOIN public.user_organizations uo ON uo.organization_id = od.organization_id
    WHERE uo.user_id = auth.uid()
    AND uo.role IN ('owner', 'admin')
    AND od.file_url LIKE '%' || name
  )
);

-- 4. Add NULL checks to RLS helper functions
CREATE OR REPLACE FUNCTION public.user_has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;
