CREATE OR REPLACE FUNCTION public.verify_push_hook_secret(candidate text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT candidate IS NOT NULL AND candidate <> '' AND EXISTS (SELECT 1 FROM app_private.config WHERE key = 'apns_hook_secret' AND value = candidate); $$;
REVOKE ALL ON FUNCTION public.verify_push_hook_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_push_hook_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.normalize_notification_link(link text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
 IF link ~ '^/requests/[0-9a-fA-F-]{36}([?#].*)?$' THEN RETURN '/requests?request=' || substring(link from '^/requests/([0-9a-fA-F-]{36})'); END IF;
 IF link LIKE '/planner?task=%' THEN RETURN replace(link, '/planner?task=', '/tasks?task='); END IF;
 IF link ~ '^/tasks/[0-9a-fA-F-]{36}$' THEN RETURN '/tasks?task=' || substring(link from '^/tasks/([0-9a-fA-F-]{36})'); END IF;
 RETURN COALESCE(link, '/me');
END; $$;
REVOKE ALL ON FUNCTION public.normalize_notification_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_notification_link(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_apns_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_private, extensions
AS $$
DECLARE hook text; base text; platform_name text;
BEGIN
 SELECT value INTO hook FROM app_private.config WHERE key='apns_hook_secret';
 SELECT value INTO base FROM app_private.config WHERE key='functions_base_url';
 IF hook IS NULL OR base IS NULL THEN RETURN NEW; END IF;
 FOR platform_name IN SELECT DISTINCT platform FROM public.device_push_tokens WHERE user_id=NEW.user_id AND platform IN ('ios','web') LOOP
  BEGIN
   PERFORM net.http_post(url := base || CASE platform_name WHEN 'ios' THEN '/send-apns-push' ELSE '/send-web-push' END,
    headers := jsonb_build_object('Content-Type','application/json','x-apns-hook',hook),
    body := jsonb_build_object('user_ids',jsonb_build_array(NEW.user_id),'title',COALESCE(NEW.title,'CRSS'),'body',COALESCE(NEW.message,''),'route',public.normalize_notification_link(NEW.link),'notification_id',NEW.id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
 END LOOP;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_apns_on_notification() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE fn record; definition text;
BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('check_request_deadlines','check_delivery_arrived','planner_check_task_deadlines','planner_notify_users') LOOP
  definition := pg_get_functiondef(fn.oid);
  definition := replace(definition, '''/requests/''', '''/requests?request=''');
  definition := replace(definition, '''/planner?task=''', '''/tasks?task=''');
  EXECUTE definition;
 END LOOP;
END; $$;