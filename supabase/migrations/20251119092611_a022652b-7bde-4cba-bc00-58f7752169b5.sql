-- Add INN field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS inn text;

-- Update handle_new_user function to work with new registration flow
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
  -- Get organization data from metadata
  org_name := COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация');
  org_inn := new.raw_user_meta_data->>'inn';
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
  
  RETURN new;
END;
$$;