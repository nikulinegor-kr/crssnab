-- Create table for appendix data
CREATE TABLE IF NOT EXISTS public.appendix_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  sheet_type TEXT NOT NULL CHECK (sheet_type IN ('sheet1', 'sheet2')),
  row_number INTEGER NOT NULL,
  request_number TEXT,
  description TEXT,
  amount NUMERIC,
  contractor TEXT,
  status TEXT,
  delivery_date DATE,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(organization_id, month, year, sheet_type, row_number)
);

-- Enable RLS
ALTER TABLE public.appendix_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view org appendix data"
ON public.appendix_data
FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can insert org appendix data"
ON public.appendix_data
FOR INSERT
WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org appendix data"
ON public.appendix_data
FOR UPDATE
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org appendix data"
ON public.appendix_data
FOR DELETE
USING (user_has_org_access(auth.uid(), organization_id));

-- Create index for faster queries
CREATE INDEX idx_appendix_data_org_month_year ON public.appendix_data(organization_id, month, year, sheet_type);

-- Create trigger for updated_at
CREATE TRIGGER update_appendix_data_updated_at
BEFORE UPDATE ON public.appendix_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();