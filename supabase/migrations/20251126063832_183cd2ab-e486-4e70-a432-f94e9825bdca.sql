-- Add archived field to requests table
ALTER TABLE public.requests 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for faster filtering of non-archived requests
CREATE INDEX idx_requests_archived ON public.requests(archived);

-- Update RLS policies to handle archived requests
-- Users can still view archived requests but they will be filtered in the app
-- Archive action (update to archived=true) instead of delete
CREATE POLICY "Users can archive organization requests"
ON public.requests
FOR UPDATE
USING (user_has_org_access(auth.uid(), organization_id))
WITH CHECK (user_has_org_access(auth.uid(), organization_id));