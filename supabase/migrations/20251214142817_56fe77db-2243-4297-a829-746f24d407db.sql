-- Create table for saved request filters
CREATE TABLE public.saved_request_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_request_filters ENABLE ROW LEVEL SECURITY;

-- Users can view their own filters
CREATE POLICY "Users can view their own saved filters"
ON public.saved_request_filters
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own filters
CREATE POLICY "Users can create their own saved filters"
ON public.saved_request_filters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own filters
CREATE POLICY "Users can update their own saved filters"
ON public.saved_request_filters
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own filters
CREATE POLICY "Users can delete their own saved filters"
ON public.saved_request_filters
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_request_filters_updated_at
BEFORE UPDATE ON public.saved_request_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();