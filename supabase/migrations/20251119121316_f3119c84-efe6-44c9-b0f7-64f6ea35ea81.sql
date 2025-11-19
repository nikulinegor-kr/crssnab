-- Create request-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-documents', 'request-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for request-documents bucket
CREATE POLICY "Authenticated users can view their org documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.document_url LIKE '%' || storage.objects.name || '%'
    AND user_has_org_access(auth.uid(), requests.organization_id)
  )
);

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update their org documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.document_url LIKE '%' || storage.objects.name || '%'
    AND user_has_org_access(auth.uid(), requests.organization_id)
  )
);

CREATE POLICY "Authenticated users can delete their org documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests
    WHERE requests.document_url LIKE '%' || storage.objects.name || '%'
    AND user_has_org_access(auth.uid(), requests.organization_id)
  )
);