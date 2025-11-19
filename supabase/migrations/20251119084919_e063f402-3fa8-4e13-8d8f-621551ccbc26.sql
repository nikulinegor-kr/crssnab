-- Create request_activities table for tracking all changes
CREATE TABLE IF NOT EXISTS public.request_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_request_activities_request_id ON public.request_activities(request_id);
CREATE INDEX idx_request_activities_created_at ON public.request_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.request_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activities for requests in their org"
  ON public.request_activities
  FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "System can insert activities"
  ON public.request_activities
  FOR INSERT
  WITH CHECK (true);

-- Function to log request activity
CREATE OR REPLACE FUNCTION public.log_request_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log creation
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.request_activities (
      request_id,
      organization_id,
      user_id,
      action,
      description
    ) VALUES (
      NEW.id,
      NEW.organization_id,
      NEW.created_by,
      'created',
      'Заявка создана'
    );
    RETURN NEW;
  END IF;

  -- Log updates
  IF (TG_OP = 'UPDATE') THEN
    -- Status changed
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO public.request_activities (
        request_id,
        organization_id,
        user_id,
        action,
        field_name,
        old_value,
        new_value,
        description
      ) VALUES (
        NEW.id,
        NEW.organization_id,
        auth.uid(),
        'status_changed',
        'status',
        OLD.status,
        NEW.status,
        'Статус изменён с "' || COALESCE(OLD.status, '') || '" на "' || COALESCE(NEW.status, '') || '"'
      );
    END IF;

    -- Priority changed
    IF (OLD.priority IS DISTINCT FROM NEW.priority) THEN
      INSERT INTO public.request_activities (
        request_id,
        organization_id,
        user_id,
        action,
        field_name,
        old_value,
        new_value,
        description
      ) VALUES (
        NEW.id,
        NEW.organization_id,
        auth.uid(),
        'priority_changed',
        'priority',
        OLD.priority,
        NEW.priority,
        'Приоритет изменён с "' || COALESCE(OLD.priority, '') || '" на "' || COALESCE(NEW.priority, '') || '"'
      );
    END IF;

    -- Executor assigned
    IF (OLD.executor IS DISTINCT FROM NEW.executor) THEN
      IF (OLD.executor IS NULL AND NEW.executor IS NOT NULL) THEN
        INSERT INTO public.request_activities (
          request_id,
          organization_id,
          user_id,
          action,
          field_name,
          new_value,
          description
        ) VALUES (
          NEW.id,
          NEW.organization_id,
          auth.uid(),
          'executor_assigned',
          'executor',
          NEW.executor,
          'Назначен исполнитель: ' || NEW.executor
        );
      ELSIF (OLD.executor IS NOT NULL AND NEW.executor IS NULL) THEN
        INSERT INTO public.request_activities (
          request_id,
          organization_id,
          user_id,
          action,
          field_name,
          old_value,
          description
        ) VALUES (
          NEW.id,
          NEW.organization_id,
          auth.uid(),
          'executor_removed',
          'executor',
          OLD.executor,
          'Исполнитель удалён: ' || OLD.executor
        );
      ELSE
        INSERT INTO public.request_activities (
          request_id,
          organization_id,
          user_id,
          action,
          field_name,
          old_value,
          new_value,
          description
        ) VALUES (
          NEW.id,
          NEW.organization_id,
          auth.uid(),
          'executor_changed',
          'executor',
          OLD.executor,
          NEW.executor,
          'Исполнитель изменён с "' || OLD.executor || '" на "' || NEW.executor || '"'
        );
      END IF;
    END IF;

    -- Invoice added/changed
    IF (OLD.invoice_number IS DISTINCT FROM NEW.invoice_number AND NEW.invoice_number IS NOT NULL) THEN
      INSERT INTO public.request_activities (
        request_id,
        organization_id,
        user_id,
        action,
        field_name,
        new_value,
        description
      ) VALUES (
        NEW.id,
        NEW.organization_id,
        auth.uid(),
        'invoice_added',
        'invoice_number',
        NEW.invoice_number,
        'Добавлен счёт №' || NEW.invoice_number
      );
    END IF;

    -- Photo added
    IF (OLD.photo_url IS NULL AND NEW.photo_url IS NOT NULL) THEN
      INSERT INTO public.request_activities (
        request_id,
        organization_id,
        user_id,
        action,
        description
      ) VALUES (
        NEW.id,
        NEW.organization_id,
        auth.uid(),
        'photo_added',
        'Добавлено фото'
      );
    END IF;

    -- Document added
    IF (OLD.document_url IS NULL AND NEW.document_url IS NOT NULL) THEN
      INSERT INTO public.request_activities (
        request_id,
        organization_id,
        user_id,
        action,
        description
      ) VALUES (
        NEW.id,
        NEW.organization_id,
        auth.uid(),
        'document_added',
        'Добавлен документ'
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Create trigger for logging activities
DROP TRIGGER IF EXISTS trigger_log_request_activity ON public.requests;
CREATE TRIGGER trigger_log_request_activity
  AFTER INSERT OR UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_request_activity();