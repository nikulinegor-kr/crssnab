
-- 1) Storage: drop broad authenticated upload policies (org-scoped policies already exist)
DROP POLICY IF EXISTS "Authenticated can upload request photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload request documents" ON storage.objects;

-- 2) Storage SELECT/DELETE policies — extend to match photo_urls/document_urls arrays
DROP POLICY IF EXISTS "Org members can view request documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view their org documents" ON storage.objects;
CREATE POLICY "Org members can view request documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'request-documents'
  AND EXISTS (
    SELECT 1 FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.document_url LIKE '%' || objects.name
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(r.document_urls, ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
        OR r.request_number = (storage.foldername(objects.name))[1]
      )
  )
);

DROP POLICY IF EXISTS "Org members can delete request documents" ON storage.objects;
CREATE POLICY "Org members can delete request documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-documents'
  AND EXISTS (
    SELECT 1 FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.document_url LIKE '%' || objects.name
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(r.document_urls, ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
        OR r.request_number = (storage.foldername(objects.name))[1]
      )
  )
);

DROP POLICY IF EXISTS "Org members can view request photos" ON storage.objects;
CREATE POLICY "Org members can view request photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'request-photos'
  AND EXISTS (
    SELECT 1 FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.photo_url LIKE '%' || objects.name
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(r.photo_urls, ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
        OR r.request_number = (storage.foldername(objects.name))[1]
      )
  )
);

DROP POLICY IF EXISTS "Org members can delete request photos" ON storage.objects;
CREATE POLICY "Org members can delete request photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-photos'
  AND EXISTS (
    SELECT 1 FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.photo_url LIKE '%' || objects.name
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(r.photo_urls, ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
        OR r.request_number = (storage.foldername(objects.name))[1]
      )
  )
);

-- 3) Profiles: allow org members to read profiles of their colleagues
CREATE POLICY "Org members can view colleague profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo1
    JOIN public.user_organizations uo2 ON uo1.organization_id = uo2.organization_id
    WHERE uo1.user_id = auth.uid() AND uo2.user_id = profiles.id
  )
);

-- 4) telegram_settings: revoke direct client read of bot_token (still accessible via SECURITY DEFINER RPC)
REVOKE SELECT (bot_token) ON public.telegram_settings FROM authenticated, anon;
