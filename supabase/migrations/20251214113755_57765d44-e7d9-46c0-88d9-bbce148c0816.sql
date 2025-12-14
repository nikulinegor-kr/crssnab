-- Create request_comments table for discussion history
CREATE TABLE public.request_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create linked_requests table for connecting similar requests
CREATE TABLE public.linked_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  linked_request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(request_id, linked_request_id)
);

-- Create request_reminders table for deadline notifications
CREATE TABLE public.request_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message TEXT,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for request_comments
CREATE POLICY "Users can view comments on their org requests"
  ON public.request_comments FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can create comments on their org requests"
  ON public.request_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    request_id IN (
      SELECT id FROM public.requests WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.request_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.request_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for linked_requests
CREATE POLICY "Users can view linked requests in their org"
  ON public.linked_requests FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can link requests in their org"
  ON public.linked_requests FOR INSERT
  WITH CHECK (
    request_id IN (
      SELECT id FROM public.requests WHERE user_can_edit_requests(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can unlink requests in their org"
  ON public.linked_requests FOR DELETE
  USING (
    request_id IN (
      SELECT id FROM public.requests WHERE user_can_edit_requests(auth.uid(), organization_id)
    )
  );

-- RLS Policies for request_reminders
CREATE POLICY "Users can view their own reminders"
  ON public.request_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create reminders for org requests"
  ON public.request_reminders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    request_id IN (
      SELECT id FROM public.requests WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update their own reminders"
  ON public.request_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON public.request_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updating updated_at
CREATE TRIGGER update_request_comments_updated_at
  BEFORE UPDATE ON public.request_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_comments;