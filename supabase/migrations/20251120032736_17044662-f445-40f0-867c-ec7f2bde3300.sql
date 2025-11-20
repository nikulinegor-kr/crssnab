-- Fix infinite recursion in conversations RLS policy

-- Remove old recursive policy if it exists
DROP POLICY IF EXISTS "Users can view org conversations they participate in" ON public.conversations;

-- Create a simpler, non-recursive policy for viewing conversations
CREATE POLICY "Users can view org conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_organizations
    WHERE user_id = auth.uid()
  )
);