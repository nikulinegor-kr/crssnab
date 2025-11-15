-- Recreate SELECT policy allowing anyone to read
DROP POLICY IF EXISTS "Authenticated users can view all requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can view requests" ON public.requests;
CREATE POLICY "Anyone can view requests"
ON public.requests
FOR SELECT
USING (true);

-- Create INSERT policies for storage (WITH CHECK only)
DROP POLICY IF EXISTS "Authenticated users can upload request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload request photos" ON storage.objects;
CREATE POLICY "Anyone can upload request photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'request-photos');

DROP POLICY IF EXISTS "Authenticated users can upload request documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload request documents" ON storage.objects;
CREATE POLICY "Anyone can upload request documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'request-documents');