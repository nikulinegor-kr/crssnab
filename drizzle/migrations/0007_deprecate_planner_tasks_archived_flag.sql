-- The planner already hides legacy auto tasks via hidden_auto / archived_at,
-- so the separate "archived" flag added earlier is redundant.
COMMENT ON COLUMN public.planner_tasks.archived IS
  'DEPRECATED: use hidden_auto / archived_at instead. Kept only for backward compatibility.';

DROP INDEX IF EXISTS public.idx_planner_tasks_active;

-- Index matching the query the planner actually runs.
CREATE INDEX IF NOT EXISTS idx_planner_tasks_visible
  ON public.planner_tasks (organization_id, position, created_at DESC)
  WHERE hidden_auto = false AND archived_at IS NULL;
