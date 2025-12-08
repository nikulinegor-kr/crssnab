-- Make request-documents bucket private for security
UPDATE storage.buckets
SET public = false
WHERE id = 'request-documents';