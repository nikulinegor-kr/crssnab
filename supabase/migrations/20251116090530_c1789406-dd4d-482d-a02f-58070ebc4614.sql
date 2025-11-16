-- Fix storage bucket security: Make buckets private and update RLS policies

-- Make buckets private
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('request-photos', 'request-documents');

-- Drop existing public access policies
DROP POLICY IF EXISTS "Anyone can view request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view request documents" ON storage.objects;

-- Create restricted policies for request-photos bucket
CREATE POLICY "Org members can view request photos" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'request-photos' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.photo_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can upload request photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'request-photos' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Org members can update request photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'request-photos' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.photo_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete request photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'request-photos' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.photo_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);

-- Create restricted policies for request-documents bucket
CREATE POLICY "Org members can view request documents" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.document_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can upload request documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'request-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Org members can update request documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.document_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete request documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'request-documents' AND
  EXISTS (
    SELECT 1 FROM requests r
    JOIN user_organizations uo ON r.organization_id = uo.organization_id
    WHERE r.document_url LIKE '%' || name AND uo.user_id = auth.uid()
  )
);