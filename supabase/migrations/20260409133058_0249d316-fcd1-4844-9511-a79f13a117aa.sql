ALTER TABLE public.request_activities 
ADD COLUMN IF NOT EXISTS snapshot jsonb DEFAULT NULL;

ALTER TABLE public.telegram_settings
ADD COLUMN IF NOT EXISTS procurement_chat_id text DEFAULT NULL;

ALTER TABLE public.telegram_settings
ADD COLUMN IF NOT EXISTS auto_send_to_procurement boolean DEFAULT true;