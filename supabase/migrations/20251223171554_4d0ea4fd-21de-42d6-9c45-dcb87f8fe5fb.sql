-- Create table for request objects
CREATE TABLE public.request_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_objects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage objects"
ON public.request_objects
FOR ALL
USING (user_is_org_admin(auth.uid(), organization_id))
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Users can view org objects"
ON public.request_objects
FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

-- Add columns to requests table
ALTER TABLE public.requests 
ADD COLUMN object_id UUID REFERENCES public.request_objects(id),
ADD COLUMN estimated_delivery_days INTEGER;

-- Create index for performance
CREATE INDEX idx_request_objects_org ON public.request_objects(organization_id);
CREATE INDEX idx_requests_object_id ON public.requests(object_id);