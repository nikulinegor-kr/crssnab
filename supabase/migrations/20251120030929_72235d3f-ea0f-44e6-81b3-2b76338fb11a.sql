-- Создаем storage bucket для файлов чата
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Создаем таблицу для вложений в сообщениях
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);

-- RLS политики для вложений
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their conversations"
ON public.message_attachments FOR SELECT
USING (
  message_id IN (
    SELECT m.id FROM messages m
    WHERE m.conversation_id IN (
      SELECT cp.conversation_id 
      FROM conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload attachments to their messages"
ON public.message_attachments FOR INSERT
WITH CHECK (
  message_id IN (
    SELECT m.id FROM messages m
    WHERE m.sender_id = auth.uid()
  )
);

-- RLS политики для storage bucket chat-files
CREATE POLICY "Users can view files in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their uploaded files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::text 
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Добавляем поля в таблицу tasks для статусов выполнения
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completion_status TEXT,
ADD COLUMN IF NOT EXISTS completion_comment TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id);

-- Создаем таблицу для уведомлений по задачам
CREATE TABLE IF NOT EXISTS public.task_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON public.task_notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON public.task_notifications(user_id);

-- RLS политики для уведомлений задач
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task notifications for their org"
ON public.task_notifications FOR SELECT
USING (
  task_id IN (
    SELECT t.id FROM tasks t
    WHERE user_has_org_access(auth.uid(), t.organization_id)
  )
);

CREATE POLICY "Users can create task notifications"
ON public.task_notifications FOR INSERT
WITH CHECK (
  task_id IN (
    SELECT t.id FROM tasks t
    WHERE user_has_org_access(auth.uid(), t.organization_id)
  )
);

CREATE POLICY "Users can update task notifications"
ON public.task_notifications FOR UPDATE
USING (
  task_id IN (
    SELECT t.id FROM tasks t
    WHERE user_has_org_access(auth.uid(), t.organization_id)
  )
);

CREATE POLICY "Users can delete task notifications"
ON public.task_notifications FOR DELETE
USING (
  task_id IN (
    SELECT t.id FROM tasks t
    WHERE user_has_org_access(auth.uid(), t.organization_id)
  )
);