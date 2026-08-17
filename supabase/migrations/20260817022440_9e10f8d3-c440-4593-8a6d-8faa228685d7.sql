ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS is_project boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requests_parent_request_id ON public.requests(parent_request_id);
CREATE INDEX IF NOT EXISTS idx_requests_is_project ON public.requests(is_project) WHERE is_project = true;