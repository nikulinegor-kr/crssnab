CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON public.device_push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx ON public.device_push_tokens(user_id);

-- Private config for the APNs webhook shared secret
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.config (
  key text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON app_private.config FROM PUBLIC, anon, authenticated;

INSERT INTO app_private.config(key, value)
VALUES ('apns_hook_secret', '61e44c2c7b3ce0bead8566901c8a4966e0adf849cd3313f3')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO app_private.config(key, value)
VALUES ('functions_base_url', 'https://cfdwsdydbtwaljnidirf.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.notify_apns_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private, extensions
AS $$
DECLARE
  _secret text;
  _base text;
BEGIN
  SELECT value INTO _secret FROM app_private.config WHERE key = 'apns_hook_secret';
  SELECT value INTO _base FROM app_private.config WHERE key = 'functions_base_url';
  IF _secret IS NULL OR _base IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.device_push_tokens WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _base || '/send-apns-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-apns-hook', _secret),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(NEW.user_id),
      'title', COALESCE(NEW.title, 'CRSS'),
      'body', COALESCE(NEW.message, ''),
      'route', NEW.link,
      'notification_id', NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_apns_push ON public.notifications;
CREATE TRIGGER notifications_apns_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_apns_on_notification();