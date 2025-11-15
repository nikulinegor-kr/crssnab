-- Create profiles table for user organizations
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, organization_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Моя организация')
  );
  RETURN new;
END;
$$;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for requests to be user-specific
DROP POLICY IF EXISTS "Anyone can view requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can create requests" ON public.requests;

CREATE POLICY "Users can view their own requests"
ON public.requests
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own requests"
ON public.requests
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own requests"
ON public.requests
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own requests"
ON public.requests
FOR DELETE
USING (auth.uid() = created_by);