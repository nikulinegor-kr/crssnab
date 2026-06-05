
-- 1) Fix deadstock SELECT policies: match against storage object path, not the item's own name field.
DROP POLICY IF EXISTS "Org members can view deadstock photos" ON storage.objects;
CREATE POLICY "Org members can view deadstock photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deadstock-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

DROP POLICY IF EXISTS "Org members can view deadstock documents" ON storage.objects;
CREATE POLICY "Org members can view deadstock documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deadstock-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

-- Insert policies (so org members can upload deadstock files into their own org folder).
DROP POLICY IF EXISTS "Org members can upload deadstock photos" ON storage.objects;
CREATE POLICY "Org members can upload deadstock photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deadstock-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

DROP POLICY IF EXISTS "Org members can upload deadstock documents" ON storage.objects;
CREATE POLICY "Org members can upload deadstock documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deadstock-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

-- 2) Replace overly permissive planner-attachments policies with org-scoped ones.
-- File path convention: {orgId}/{uuid}-{filename}
DROP POLICY IF EXISTS "Planner attach read auth" ON storage.objects;
DROP POLICY IF EXISTS "Planner attach update auth" ON storage.objects;
DROP POLICY IF EXISTS "Planner attach delete auth" ON storage.objects;
DROP POLICY IF EXISTS "Planner attach insert auth" ON storage.objects;

CREATE POLICY "Org members can read planner attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'planner-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can upload planner attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'planner-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can update planner attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'planner-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Org members can delete planner attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'planner-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id::text = (storage.foldername(objects.name))[1]
  )
);
