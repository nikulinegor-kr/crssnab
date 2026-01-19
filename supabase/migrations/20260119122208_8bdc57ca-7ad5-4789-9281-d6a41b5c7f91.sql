-- Fix insecure RLS policy on request_activities table
-- The trigger function log_request_activity() uses SECURITY DEFINER, so it will bypass RLS
DROP POLICY IF EXISTS "System can insert activities" ON public.request_activities;

CREATE POLICY "Users can insert activities for their org requests"
ON public.request_activities
FOR INSERT
WITH CHECK (
  user_has_org_access(auth.uid(), organization_id)
  AND request_id IN (
    SELECT id FROM public.requests WHERE organization_id = request_activities.organization_id
  )
);

-- Fix insecure RLS policy on notifications table
-- The functions check_request_deadlines() and check_upcoming_events() use SECURITY DEFINER
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can create notifications for themselves"
ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND user_has_org_access(auth.uid(), organization_id)
);