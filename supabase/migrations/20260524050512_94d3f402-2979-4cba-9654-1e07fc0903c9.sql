-- Allow deletion of discovered (unassigned) max groups by any authenticated user
DROP POLICY IF EXISTS "Authenticated can delete discovered max groups" ON public.max_groups;
CREATE POLICY "Authenticated can delete discovered max groups"
  ON public.max_groups FOR DELETE
  TO authenticated
  USING (organization_id IS NULL);
