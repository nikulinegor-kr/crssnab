-- Add column to store all telegram message IDs for a request
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS telegram_message_ids integer[] DEFAULT '{}';

-- Migrate existing telegram_message_id to the new array if it exists
UPDATE public.requests 
SET telegram_message_ids = ARRAY[telegram_message_id]
WHERE telegram_message_id IS NOT NULL 
  AND (telegram_message_ids IS NULL OR telegram_message_ids = '{}');