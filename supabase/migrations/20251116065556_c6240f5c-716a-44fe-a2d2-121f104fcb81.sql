-- Add Telegram bot settings to organizations table
ALTER TABLE public.organizations 
ADD COLUMN telegram_bot_token text,
ADD COLUMN telegram_chat_id text;