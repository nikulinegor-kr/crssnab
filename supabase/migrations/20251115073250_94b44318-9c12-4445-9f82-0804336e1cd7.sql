-- Add full_name and position columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;

-- Update the handle_new_user trigger function to support full_name and position
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  -- Insert profile with full_name and position from metadata
  INSERT INTO public.profiles (id, email, organization_name, full_name, position)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'position'
  );
  
  -- Create organization only if it's a new signup (not admin-created user)
  IF new.raw_user_meta_data->>'organization_name' IS NOT NULL THEN
    org_name := COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация');
    INSERT INTO public.organizations (name)
    VALUES (org_name)
    RETURNING id INTO new_org_id;
    
    -- Add user as owner of the organization
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (new.id, new_org_id, 'owner');
  END IF;
  
  RETURN new;
END;
$$;