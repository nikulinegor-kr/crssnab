-- Make request-documents bucket public so existing public URLs work
UPDATE storage.buckets
SET public = true
WHERE id = 'request-documents';