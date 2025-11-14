-- Create requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL,
  request_date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Новая',
  availability_delivery_time TEXT,
  contractor TEXT,
  invoice_number TEXT,
  payment_percentage INTEGER DEFAULT 0,
  shipment_date DATE,
  delivery_date DATE,
  transport_company TEXT,
  waybill_number TEXT,
  comments TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_date ON public.requests(request_date DESC);
CREATE INDEX idx_requests_created_by ON public.requests(created_by);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can view all requests
CREATE POLICY "Authenticated users can view all requests"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: authenticated users can create requests
CREATE POLICY "Authenticated users can create requests"
  ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies: authenticated users can update their own requests
CREATE POLICY "Authenticated users can update requests"
  ON public.requests
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies: authenticated users can delete their own requests
CREATE POLICY "Authenticated users can delete their own requests"
  ON public.requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();