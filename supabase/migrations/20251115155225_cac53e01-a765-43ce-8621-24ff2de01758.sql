-- Allow users to view profiles of users in the same organization
CREATE POLICY "Users can view profiles in their organizations"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_organizations uo1
    INNER JOIN public.user_organizations uo2 
      ON uo1.organization_id = uo2.organization_id
    WHERE uo1.user_id = auth.uid() 
      AND uo2.user_id = profiles.id
  )
);