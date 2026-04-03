
-- 1. Make deadstock buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('deadstock-photos', 'deadstock-documents');

-- 2. Drop anonymous "Anyone can view" policies
DROP POLICY IF EXISTS "Anyone can view deadstock photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view deadstock documents" ON storage.objects;

-- 3. Add org-scoped SELECT policies for deadstock buckets
CREATE POLICY "Org members can view deadstock photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deadstock-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM deadstock_items di
    JOIN user_organizations uo ON uo.organization_id = di.organization_id
    WHERE uo.user_id = auth.uid()
      AND di.photo_urls::text LIKE '%' || name || '%'
  )
);

CREATE POLICY "Org members can view deadstock documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deadstock-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM deadstock_items di
    JOIN user_organizations uo ON uo.organization_id = di.organization_id
    WHERE uo.user_id = auth.uid()
      AND di.document_urls::text LIKE '%' || name || '%'
  )
);

-- 4. Fix subscriptions: replace broad SELECT with admin-only + safe view for members
DROP POLICY IF EXISTS "Users can view their org subscriptions" ON subscriptions;

-- Create a safe view that excludes Stripe IDs for non-admins
CREATE OR REPLACE FUNCTION public.get_subscription_safe(_org_id uuid)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  plan_id uuid,
  status text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.organization_id, s.plan_id, s.status,
         s.trial_ends_at, s.current_period_start, s.current_period_end,
         s.created_at, s.updated_at
  FROM subscriptions s
  WHERE s.organization_id = _org_id
    AND user_has_org_access(auth.uid(), _org_id);
$$;

-- Only admins can directly query the subscriptions table (to see Stripe IDs)
CREATE POLICY "Only admins can view subscriptions directly"
ON subscriptions FOR SELECT
USING (user_is_org_admin(auth.uid(), organization_id));

-- 5. Remove telegram credentials from organizations table (moved to telegram_settings)
ALTER TABLE organizations DROP COLUMN IF EXISTS telegram_bot_token;
ALTER TABLE organizations DROP COLUMN IF EXISTS telegram_chat_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS telegram_invoice_chat_id;
