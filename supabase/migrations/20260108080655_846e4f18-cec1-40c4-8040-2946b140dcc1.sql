-- Make request-photos bucket public
UPDATE storage.buckets SET public = true WHERE id = 'request-photos';

-- Also make request-documents public for consistency
UPDATE storage.buckets SET public = true WHERE id = 'request-documents';