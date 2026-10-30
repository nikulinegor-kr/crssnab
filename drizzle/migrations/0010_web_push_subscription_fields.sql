ALTER TABLE public.device_push_tokens
  ADD COLUMN IF NOT EXISTS p256dh text NULL,
  ADD COLUMN IF NOT EXISTS auth text NULL,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fail_count int NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.device_push_tokens.p256dh IS 'Web Push subscription public encryption key; null for native tokens';
COMMENT ON COLUMN public.device_push_tokens.auth IS 'Web Push subscription authentication secret; null for native tokens';