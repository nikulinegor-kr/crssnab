DROP FUNCTION IF EXISTS public.get_telegram_credentials(uuid);

CREATE FUNCTION public.get_telegram_credentials(_org_id uuid)
RETURNS TABLE(
  telegram_bot_token text,
  telegram_chat_id text,
  telegram_auto_send_on_create boolean,
  telegram_auto_send_on_status_change boolean,
  telegram_invoice_chat_id text,
  telegram_procurement_chat_id text,
  telegram_auto_send_to_procurement boolean,
  telegram_deadline_chat_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    bot_token,
    chat_id,
    auto_send_on_create,
    auto_send_on_status_change,
    invoice_chat_id,
    procurement_chat_id,
    auto_send_to_procurement,
    deadline_chat_id
  FROM telegram_settings 
  WHERE organization_id = _org_id 
    AND user_is_org_admin(auth.uid(), _org_id);
$$;