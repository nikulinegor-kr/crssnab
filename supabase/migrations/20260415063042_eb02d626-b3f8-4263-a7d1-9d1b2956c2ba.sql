CREATE OR REPLACE FUNCTION public.get_telegram_auto_send_settings(_org_id uuid)
RETURNS TABLE(auto_send_on_create boolean, auto_send_on_status_change boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COALESCE(auto_send_on_create, true),
    COALESCE(auto_send_on_status_change, true)
  FROM telegram_settings 
  WHERE organization_id = _org_id 
    AND user_has_org_access(auth.uid(), _org_id)
$$;