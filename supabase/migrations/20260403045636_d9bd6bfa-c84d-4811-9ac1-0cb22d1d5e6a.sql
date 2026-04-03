
-- Update get_organization_safe to remove dropped telegram columns
CREATE OR REPLACE FUNCTION public.get_organization_safe(_org_id uuid)
RETURNS TABLE(id uuid, name text, description text, logo_url text, primary_color text, secondary_color text, contact_email text, contact_phone text, telegram_auto_send_on_create boolean, telegram_auto_send_on_status_change boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, name, description, logo_url, primary_color, secondary_color,
    contact_email, contact_phone, 
    telegram_auto_send_on_create, telegram_auto_send_on_status_change,
    created_at, updated_at
  FROM public.organizations
  WHERE id = _org_id
  AND user_has_org_access(auth.uid(), id);
$$;
