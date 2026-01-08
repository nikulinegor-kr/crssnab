-- Add array columns for multiple files (keeping old columns for backwards compatibility)
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS document_urls text[] DEFAULT '{}';