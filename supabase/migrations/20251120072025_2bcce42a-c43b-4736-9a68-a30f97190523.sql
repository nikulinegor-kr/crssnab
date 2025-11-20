-- Fix chat-files bucket security vulnerability

-- Step 1: Make bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-files';

-- Step 2: Drop ALL existing chat-files policies (both secure and insecure)
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their conversations" ON storage.objects;

-- Step 3: Create secure conversation-based access control policies
CREATE POLICY "Users can view files in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete files from their conversations"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);