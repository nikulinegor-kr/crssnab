-- After switching request-photos and request-documents to private buckets,
-- ensure any authenticated org user can read/sign files in those buckets.
-- (Object-level org scoping is enforced by the requests table RLS.)

DROP POLICY IF EXISTS "Public can view request photos"     ON storage.objects;
DROP POLICY IF EXISTS "Public can view request documents"  ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view request photos"     ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view request documents"  ON storage.objects;

CREATE POLICY "Authenticated can read request photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'request-photos');

CREATE POLICY "Authenticated can read request documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'request-documents');

CREATE POLICY "Authenticated can upload request photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'request-photos');

CREATE POLICY "Authenticated can upload request documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'request-documents');
