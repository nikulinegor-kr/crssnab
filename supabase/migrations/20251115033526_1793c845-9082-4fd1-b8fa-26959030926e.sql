-- Create storage buckets for request files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('request-photos', 'request-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('request-documents', 'request-documents', true, 10485760, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- RLS policies for request-photos bucket
CREATE POLICY "Anyone can view request photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'request-photos');

CREATE POLICY "Authenticated users can upload request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'request-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own request photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'request-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own request photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'request-photos' AND auth.role() = 'authenticated');

-- RLS policies for request-documents bucket
CREATE POLICY "Anyone can view request documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'request-documents');

CREATE POLICY "Authenticated users can upload request documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'request-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own request documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'request-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own request documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'request-documents' AND auth.role() = 'authenticated');

-- Add columns to requests table for file paths
ALTER TABLE public.requests
ADD COLUMN photo_url text,
ADD COLUMN document_url text;