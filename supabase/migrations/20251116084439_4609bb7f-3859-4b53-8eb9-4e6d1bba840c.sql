-- Restrict profile email visibility to owner and admins only
DROP POLICY IF EXISTS "Users can view profiles in their organizations" ON profiles;

CREATE POLICY "Users can view own profile or admins can view all"
ON profiles FOR SELECT
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM user_organizations uo1
    JOIN user_organizations uo2 ON uo1.organization_id = uo2.organization_id
    WHERE uo1.user_id = auth.uid() 
      AND uo2.user_id = profiles.id
      AND uo1.role IN ('owner', 'admin')
  )
);