-- Fix handle_new_user to properly detect registration vs admin-created users
-- Use 'inn' field as indicator for organization registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_inn TEXT;
  org_phone TEXT;
BEGIN
  org_inn := new.raw_user_meta_data->>'inn';
  
  -- If INN is present, this is an organization registration (create new org)
  IF org_inn IS NOT NULL AND org_inn != '' THEN
    org_name := COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация');
    org_phone := new.raw_user_meta_data->>'phone';
    
    -- Create organization with INN and phone
    INSERT INTO public.organizations (name, inn, contact_email, contact_phone)
    VALUES (org_name, org_inn, new.email, org_phone)
    RETURNING id INTO new_org_id;
    
    -- Create profile
    INSERT INTO public.profiles (id, email, organization_name)
    VALUES (new.id, new.email, org_name);
    
    -- Add user as owner of the organization
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (new.id, new_org_id, 'owner');
  ELSE
    -- Admin-created user: only create profile
    -- Organization membership will be added by edge function
    INSERT INTO public.profiles (id, email, organization_name, full_name, position)
    VALUES (
      new.id, 
      new.email, 
      COALESCE(new.raw_user_meta_data->>'organization_name', ''),
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'position'
    );
  END IF;
  
  RETURN new;
END;
$$;