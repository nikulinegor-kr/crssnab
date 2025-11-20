-- Update chat-files bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'chat-files';

-- Create RLS policies for chat-files bucket if they don't exist
DO $$ 
BEGIN
  -- Policy for viewing files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view chat files'
  ) THEN
    CREATE POLICY "Users can view chat files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-files');
  END IF;

  -- Policy for uploading files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload chat files'
  ) THEN
    CREATE POLICY "Users can upload chat files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);
  END IF;

  -- Policy for deleting files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their chat files'
  ) THEN
    CREATE POLICY "Users can delete their chat files"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);
  END IF;
END $$;