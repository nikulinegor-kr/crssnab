-- ensure_user_initialized function to bootstrap profile, organization and owner membership for current user
CREATE OR REPLACE FUNCTION public.ensure_user_initialized(_org_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_org_id uuid;
  user_email text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN;
  END IF;

  -- Get email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  -- Create profile if missing
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    INSERT INTO public.profiles (id, email, organization_name)
    VALUES (uid, COALESCE(user_email, ''), COALESCE(_org_name, 'Моя организация'));
  END IF;

  -- If user has no organizations, create one and assign as owner
  IF NOT EXISTS (SELECT 1 FROM public.user_organizations WHERE user_id = uid) THEN
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(_org_name, 'Моя организация'))
    RETURNING id INTO new_org_id;

    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (uid, new_org_id, 'owner');
  END IF;
END;
$$;