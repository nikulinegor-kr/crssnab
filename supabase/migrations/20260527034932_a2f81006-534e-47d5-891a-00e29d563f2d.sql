
-- Planner tasks
CREATE TABLE public.planner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  object_id uuid REFERENCES public.request_objects(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'backlog',
  priority text NOT NULL DEFAULT 'medium',
  assignee_id uuid,
  created_by uuid,
  start_date timestamptz,
  due_date timestamptz,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_tasks TO authenticated;
GRANT ALL ON public.planner_tasks TO service_role;

ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view planner tasks"
  ON public.planner_tasks FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members insert planner tasks"
  ON public.planner_tasks FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members update planner tasks"
  ON public.planner_tasks FOR UPDATE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members delete planner tasks"
  ON public.planner_tasks FOR DELETE TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE INDEX idx_planner_tasks_org ON public.planner_tasks(organization_id);
CREATE INDEX idx_planner_tasks_object ON public.planner_tasks(object_id);
CREATE INDEX idx_planner_tasks_assignee ON public.planner_tasks(assignee_id);
CREATE INDEX idx_planner_tasks_status ON public.planner_tasks(organization_id, status, position);
CREATE INDEX idx_planner_tasks_parent ON public.planner_tasks(parent_task_id);

CREATE TRIGGER planner_tasks_set_updated_at
  BEFORE UPDATE ON public.planner_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER planner_tasks_set_created_by
  BEFORE INSERT ON public.planner_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Comments
CREATE TABLE public.planner_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_task_comments TO authenticated;
GRANT ALL ON public.planner_task_comments TO service_role;

ALTER TABLE public.planner_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view planner comments"
  ON public.planner_task_comments FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members insert own planner comments"
  ON public.planner_task_comments FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id) AND user_id = auth.uid());

CREATE POLICY "Authors or admins update planner comments"
  ON public.planner_task_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Authors or admins delete planner comments"
  ON public.planner_task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR user_is_org_admin(auth.uid(), organization_id));

CREATE INDEX idx_planner_comments_task ON public.planner_task_comments(task_id, created_at);

CREATE TRIGGER planner_task_comments_set_updated_at
  BEFORE UPDATE ON public.planner_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity log
CREATE TABLE public.planner_task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.planner_task_activity TO authenticated;
GRANT ALL ON public.planner_task_activity TO service_role;

ALTER TABLE public.planner_task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view planner activity"
  ON public.planner_task_activity FOR SELECT TO authenticated
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org members insert planner activity"
  ON public.planner_task_activity FOR INSERT TO authenticated
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE INDEX idx_planner_activity_task ON public.planner_task_activity(task_id, created_at DESC);
