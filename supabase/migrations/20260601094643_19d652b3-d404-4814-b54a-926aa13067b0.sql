DROP POLICY IF EXISTS "Org members can view object docs" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete object docs" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload object docs" ON storage.objects;

CREATE POLICY "Org members can view object docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'object-documents'
  AND EXISTS (
    SELECT 1
    FROM public.request_objects ro
    JOIN public.user_organizations uo ON uo.organization_id = ro.organization_id
    WHERE uo.user_id = auth.uid()
      AND ro.id::text = substring(objects.name FROM 1 FOR 36)
  )
);

CREATE POLICY "Org members can upload object docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'object-documents'
  AND EXISTS (
    SELECT 1
    FROM public.request_objects ro
    JOIN public.user_organizations uo ON uo.organization_id = ro.organization_id
    WHERE uo.user_id = auth.uid()
      AND ro.id::text = substring(objects.name FROM 1 FOR 36)
  )
);

CREATE POLICY "Org admins can delete object docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'object-documents'
  AND EXISTS (
    SELECT 1
    FROM public.request_objects ro
    JOIN public.user_organizations uo ON uo.organization_id = ro.organization_id
    WHERE uo.user_id = auth.uid()
      AND uo.role IN ('owner','admin')
      AND ro.id::text = substring(objects.name FROM 1 FOR 36)
  )
);

DROP POLICY IF EXISTS "Org members can upload request photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update request photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload request documents" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update request documents" ON storage.objects;

CREATE POLICY "Org members can upload request photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-photos'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND r.request_number = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can update request photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-photos'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND r.request_number = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can upload request documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-documents'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND r.request_number = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can update request documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-documents'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND r.request_number = (storage.foldername(objects.name))[1]
  )
);

REVOKE SELECT (bot_token) ON public.telegram_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.telegram_bot_configured(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.telegram_settings
    WHERE organization_id = _org_id
      AND bot_token IS NOT NULL
      AND length(bot_token) > 0
  );
$$;

GRANT EXECUTE ON FUNCTION public.telegram_bot_configured(uuid) TO authenticated;

REVOKE SELECT (phone, telegram_user_id) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_contact_info()
RETURNS TABLE (phone text, telegram_user_id bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone, telegram_user_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contact_info() TO authenticated;