-- Create admin-only function to get Telegram credentials
CREATE OR REPLACE FUNCTION get_telegram_credentials(_org_id uuid)
RETURNS TABLE (
  telegram_bot_token text,
  telegram_chat_id text,
  telegram_auto_send_on_create boolean,
  telegram_auto_send_on_status_change boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    telegram_bot_token, 
    telegram_chat_id,
    telegram_auto_send_on_create,
    telegram_auto_send_on_status_change
  FROM organizations 
  WHERE id = _org_id 
    AND user_is_org_admin(auth.uid(), id);
$$;

-- Create function to check if Telegram is configured (for non-admin users)
CREATE OR REPLACE FUNCTION is_telegram_configured(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organizations 
    WHERE id = _org_id 
      AND user_has_org_access(auth.uid(), id)
      AND telegram_bot_token IS NOT NULL 
      AND telegram_bot_token != ''
      AND telegram_chat_id IS NOT NULL 
      AND telegram_chat_id != ''
  );
$$;

-- Drop the overly permissive policy for client_invitations
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.client_invitations;

-- Create a secure function to get invitation by token (for invitation acceptance flow)
CREATE OR REPLACE FUNCTION get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email text,
  name text,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, organization_id, email, name, expires_at, used_at
  FROM client_invitations
  WHERE token = _token
    AND used_at IS NULL
    AND expires_at > now();
$$;

-- Add restrictive SELECT policy - only admins can view invitations for their org
CREATE POLICY "Admins can view org invitations"
ON public.client_invitations FOR SELECT
USING (user_is_org_admin(auth.uid(), organization_id));