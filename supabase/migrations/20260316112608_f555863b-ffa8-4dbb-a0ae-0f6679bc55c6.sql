
ALTER TABLE public.material_statement_items 
  ADD COLUMN IF NOT EXISTS procurement_request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS procurement_status text NOT NULL DEFAULT 'none';
