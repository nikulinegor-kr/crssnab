
ALTER TABLE public.filter_element_movements
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_filter_element_movements_request_id
  ON public.filter_element_movements(request_id);
CREATE INDEX IF NOT EXISTS idx_filter_element_movements_type
  ON public.filter_element_movements(filter_element_id, type);
