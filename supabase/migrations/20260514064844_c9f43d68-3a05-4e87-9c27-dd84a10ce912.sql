ALTER TABLE public.telegram_settings ADD COLUMN IF NOT EXISTS deadline_chat_id TEXT;

COMMENT ON COLUMN public.telegram_settings.deadline_chat_id IS 'Telegram chat ID for deadline/shipment notifications';