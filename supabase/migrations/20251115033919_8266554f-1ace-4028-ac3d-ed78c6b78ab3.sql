-- Update RLS policy for INSERT to allow anonymous users
DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.requests;

CREATE POLICY "Anyone can create requests" 
ON public.requests 
FOR INSERT 
WITH CHECK (true);

-- Create trigger to automatically set created_by
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_created_by_trigger
BEFORE INSERT ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();