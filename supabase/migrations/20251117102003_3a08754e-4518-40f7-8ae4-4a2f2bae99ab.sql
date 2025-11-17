-- Add telegram_username field to request_participants table
ALTER TABLE public.request_participants 
ADD COLUMN IF NOT EXISTS telegram_username text;