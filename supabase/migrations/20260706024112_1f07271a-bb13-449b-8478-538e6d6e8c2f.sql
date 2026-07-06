DROP POLICY IF EXISTS "Org members can upload request documents" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload request photos" ON storage.objects;

CREATE POLICY "Org members can upload request documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-documents'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.request_number = (storage.foldername(objects.name))[1]
        OR r.id::text = substring(objects.name FROM 1 FOR 36)
      )
  )
);

CREATE POLICY "Org members can upload request photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-photos'
  AND EXISTS (
    SELECT 1
    FROM public.requests r
    JOIN public.user_organizations uo ON uo.organization_id = r.organization_id
    WHERE uo.user_id = auth.uid()
      AND (
        r.request_number = (storage.foldername(objects.name))[1]
        OR r.id::text = substring(objects.name FROM 1 FOR 36)
      )
  )
);