ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS telegram_invoice_chat_id text;

DROP FUNCTION IF EXISTS public.get_telegram_credentials(uuid);

CREATE FUNCTION public.get_telegram_credentials(_org_id uuid)
 RETURNS TABLE(telegram_bot_token text, telegram_chat_id text, telegram_auto_send_on_create boolean, telegram_auto_send_on_status_change boolean, telegram_invoice_chat_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    telegram_bot_token, 
    telegram_chat_id,
    telegram_auto_send_on_create,
    telegram_auto_send_on_status_change,
    telegram_invoice_chat_id
  FROM organizations 
  WHERE id = _org_id 
    AND user_is_org_admin(auth.uid(), id);
$function$;