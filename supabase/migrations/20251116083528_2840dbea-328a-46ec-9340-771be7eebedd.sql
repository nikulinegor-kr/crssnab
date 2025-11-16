-- Create table for managing applicants and executors
CREATE TABLE public.request_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('applicant', 'executor')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_request_participants_org_type ON public.request_participants(organization_id, participant_type, is_active);

-- Enable RLS
ALTER TABLE public.request_participants ENABLE ROW LEVEL SECURITY;

-- Users can view participants in their organization
CREATE POLICY "Users can view org participants"
ON public.request_participants
FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

-- Admins can manage participants
CREATE POLICY "Admins can manage participants"
ON public.request_participants
FOR ALL
USING (user_is_org_admin(auth.uid(), organization_id))
WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- Add trigger for updated_at
CREATE TRIGGER update_request_participants_updated_at
BEFORE UPDATE ON public.request_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();