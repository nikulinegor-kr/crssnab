-- Создаем таблицу задач
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'В работе',
  priority TEXT NOT NULL DEFAULT 'Средний',
  due_date DATE,
  task_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Создаем таблицу событий календаря
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  event_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Включаем RLS для задач
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org tasks"
  ON public.tasks FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org tasks"
  ON public.tasks FOR UPDATE
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Admins can delete org tasks"
  ON public.tasks FOR DELETE
  USING (user_is_org_admin(auth.uid(), organization_id));

-- Включаем RLS для событий календаря
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org events"
  ON public.calendar_events FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can create org events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org events"
  ON public.calendar_events FOR UPDATE
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org events"
  ON public.calendar_events FOR DELETE
  USING (user_has_org_access(auth.uid(), organization_id));

-- Создаем индексы
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX idx_calendar_events_organization_id ON public.calendar_events(organization_id);
CREATE INDEX idx_calendar_events_start_date ON public.calendar_events(start_date);
CREATE INDEX idx_calendar_events_end_date ON public.calendar_events(end_date);

-- Триггеры для обновления updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();