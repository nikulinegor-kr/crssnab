ALTER TABLE public.user_organizations ALTER COLUMN planner_access SET DEFAULT false;
ALTER TABLE public.user_organizations ALTER COLUMN can_manage_tasks SET DEFAULT false;

UPDATE public.user_organizations
SET planner_access = false, can_manage_tasks = false
WHERE role NOT IN ('owner','admin');

UPDATE public.user_organizations
SET planner_access = true, can_manage_tasks = true
WHERE role IN ('owner','admin');

CREATE OR REPLACE FUNCTION public.user_can_see_all_tasks(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = _user_id
      AND uo.organization_id = _org_id
      AND uo.is_active IS NOT FALSE
      AND (uo.role IN ('owner','admin') OR uo.can_manage_tasks = true)
  )
$$;

DROP POLICY IF EXISTS "Org members view planner tasks" ON public.planner_tasks;
DROP POLICY IF EXISTS "Org members read tasks" ON public.planner_tasks;
DROP POLICY IF EXISTS "Org members update planner tasks" ON public.planner_tasks;
DROP POLICY IF EXISTS "Org members delete planner tasks" ON public.planner_tasks;

CREATE POLICY "Planner read own or managed tasks"
ON public.planner_tasks FOR SELECT
TO authenticated
USING (
  public.user_has_org_access(auth.uid(), organization_id)
  AND (
    public.user_can_see_all_tasks(auth.uid(), organization_id)
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  )
  AND (is_private = false OR created_by = auth.uid() OR assignee_id = auth.uid())
);

CREATE POLICY "Planner update own or managed tasks"
ON public.planner_tasks FOR UPDATE
TO authenticated
USING (
  public.user_has_org_access(auth.uid(), organization_id)
  AND (
    public.user_can_see_all_tasks(auth.uid(), organization_id)
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  )
);

CREATE POLICY "Planner delete own or managed tasks"
ON public.planner_tasks FOR DELETE
TO authenticated
USING (
  public.user_has_org_access(auth.uid(), organization_id)
  AND (
    public.user_can_see_all_tasks(auth.uid(), organization_id)
    OR created_by = auth.uid()
  )
);