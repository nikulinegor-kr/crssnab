-- Add telegram_message_id to track messages in Telegram
ALTER TABLE public.requests 
ADD COLUMN telegram_message_id bigint,
ADD COLUMN awaiting_comment_from text;