
-- 1. Fix function search_path
ALTER FUNCTION public._priority_emoji(text) SET search_path = public;
ALTER FUNCTION public._status_emoji(text) SET search_path = public;

-- 2. Deadstock buckets: scope by org prefix in path
DROP POLICY IF EXISTS "Authenticated users can upload deadstock photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update deadstock photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete deadstock photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload deadstock documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update deadstock documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete deadstock documents" ON storage.objects;

CREATE POLICY "Org members can upload deadstock photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deadstock-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can update deadstock photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'deadstock-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can delete deadstock photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'deadstock-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Org members can upload deadstock documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deadstock-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can update deadstock documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'deadstock-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can delete deadstock documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'deadstock-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);

-- 3. Material-statements bucket: org-scoped using path prefix
DROP POLICY IF EXISTS "Users can upload statement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view statement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete statement files" ON storage.objects;

CREATE POLICY "Org members can view statement files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'material-statements'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can upload statement files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'material-statements'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);
CREATE POLICY "Org members can delete statement files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'material-statements'
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(name))[1]
  )
);

-- 4. Object-documents: tighten INSERT to require membership for the
-- organization that owns the referenced material_object (file name starts with `<object_id>-`)
DROP POLICY IF EXISTS "Org members can upload object docs" ON storage.objects;
CREATE POLICY "Org members can upload object docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'object-documents'
  AND EXISTS (
    SELECT 1
    FROM public.material_objects mo
    JOIN public.user_organizations uo ON uo.organization_id = mo.organization_id
    WHERE uo.user_id = auth.uid()
      AND mo.id::text = substring(name from 1 for 36)
  )
);

-- 5. Request buckets: require authenticated user to belong to at least one organization
DROP POLICY IF EXISTS "Org members can upload request photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload request documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update request photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update request documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own request photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own request photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own request documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own request documents" ON storage.objects;

CREATE POLICY "Org members can upload request photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'request-photos'
  AND EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid())
);
CREATE POLICY "Org members can update request photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'request-photos'
  AND EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid())
);
CREATE POLICY "Org members can upload request documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'request-documents'
  AND EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid())
);
CREATE POLICY "Org members can update request documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'request-documents'
  AND EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid())
);
