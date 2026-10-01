CREATE INDEX IF NOT EXISTS idx_requests_org_status ON public.requests (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_org_priority ON public.requests (organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_requests_org_created ON public.requests (organization_id, created_at DESC);