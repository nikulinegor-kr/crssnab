
-- 1. Stages (этапы работ)
CREATE TABLE IF NOT EXISTS public.planner_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  object_id UUID REFERENCES public.request_objects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  color TEXT DEFAULT 'blue',
  status TEXT NOT NULL DEFAULT 'planned',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_stages TO authenticated;
GRANT ALL ON public.planner_stages TO service_role;
ALTER TABLE public.planner_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read stages" ON public.planner_stages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_stages.organization_id));
CREATE POLICY "Org members insert stages" ON public.planner_stages FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_stages.organization_id));
CREATE POLICY "Org members update stages" ON public.planner_stages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_stages.organization_id));
CREATE POLICY "Org members delete stages" ON public.planner_stages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_stages.organization_id));

CREATE INDEX IF NOT EXISTS idx_planner_stages_org ON public.planner_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_planner_stages_object ON public.planner_stages(object_id);

CREATE TRIGGER trg_planner_stages_updated
BEFORE UPDATE ON public.planner_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Дополнительные поля задач
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.planner_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS equipment_id UUID,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence JSONB,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.planner_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC;

CREATE INDEX IF NOT EXISTS idx_planner_tasks_stage ON public.planner_tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_planner_tasks_request ON public.planner_tasks(request_id);

-- 3. Зависимости
CREATE TABLE IF NOT EXISTS public.planner_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  blocked_by_task_id UUID NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  dep_type TEXT NOT NULL DEFAULT 'fs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, blocked_by_task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_task_dependencies TO authenticated;
GRANT ALL ON public.planner_task_dependencies TO service_role;
ALTER TABLE public.planner_task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org dep read" ON public.planner_task_dependencies FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_dependencies.organization_id));
CREATE POLICY "Org dep write" ON public.planner_task_dependencies FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_dependencies.organization_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_dependencies.organization_id));

-- 4. Шаблоны
CREATE TABLE IF NOT EXISTS public.planner_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC,
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_task_templates TO authenticated;
GRANT ALL ON public.planner_task_templates TO service_role;
ALTER TABLE public.planner_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org tpl read" ON public.planner_task_templates FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_templates.organization_id));
CREATE POLICY "Org tpl write" ON public.planner_task_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_templates.organization_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_task_templates.organization_id));

CREATE TRIGGER trg_planner_templates_updated
BEFORE UPDATE ON public.planner_task_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Storage bucket для вложений Planner
INSERT INTO storage.buckets (id, name, public)
VALUES ('planner-attachments', 'planner-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Planner attach read auth" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'planner-attachments');
CREATE POLICY "Planner attach insert auth" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'planner-attachments');
CREATE POLICY "Planner attach update auth" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'planner-attachments');
CREATE POLICY "Planner attach delete auth" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'planner-attachments');

-- 6. Приватность задач: фильтр по RLS — приватные видит только владелец/назначенный
DROP POLICY IF EXISTS "Org members read tasks" ON public.planner_tasks;
CREATE POLICY "Org members read tasks" ON public.planner_tasks FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid() AND uo.organization_id = planner_tasks.organization_id)
  AND (
    is_private = false
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  )
);
