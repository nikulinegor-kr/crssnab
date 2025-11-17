-- Add telegram_user_id to profiles for personal notifications
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_user_id bigint;