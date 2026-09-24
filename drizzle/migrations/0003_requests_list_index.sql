CREATE INDEX IF NOT EXISTS idx_requests_org_archived_project_created
  ON public.requests (organization_id, archived, is_project, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_archived_project_created
  ON public.requests (archived, is_project, created_at DESC);