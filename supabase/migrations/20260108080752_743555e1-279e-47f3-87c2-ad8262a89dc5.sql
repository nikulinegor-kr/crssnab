-- Drop restrictive UPDATE policies that check photo_url/document_url
DROP POLICY IF EXISTS "Org members can update request photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update request documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their org documents" ON storage.objects;

-- Create simpler UPDATE policies for authenticated users
CREATE POLICY "Authenticated users can update request photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'request-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update request documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'request-documents' AND auth.uid() IS NOT NULL);