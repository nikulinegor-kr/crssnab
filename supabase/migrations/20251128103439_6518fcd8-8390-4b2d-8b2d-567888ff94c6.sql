-- Drop existing table and recreate with new structure
DROP TABLE IF EXISTS public.appendix_data CASCADE;

-- Create table for agent report data
CREATE TABLE IF NOT EXISTS public.agent_report_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  report_number TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  contract_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  company_name TEXT NOT NULL,
  company_address TEXT,
  company_phone TEXT,
  recipient_name TEXT,
  recipient_position TEXT,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(organization_id, month, year)
);

-- Create table for report rows
CREATE TABLE IF NOT EXISTS public.agent_report_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.agent_report_data(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  tmc TEXT,
  contractor TEXT,
  invoice_number TEXT,
  amount NUMERIC DEFAULT 0,
  formula TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(report_id, row_number)
);

-- Enable RLS
ALTER TABLE public.agent_report_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_report_rows ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_report_data
CREATE POLICY "Users can view org report data"
ON public.agent_report_data
FOR SELECT
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can insert org report data"
ON public.agent_report_data
FOR INSERT
WITH CHECK (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can update org report data"
ON public.agent_report_data
FOR UPDATE
USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Users can delete org report data"
ON public.agent_report_data
FOR DELETE
USING (user_has_org_access(auth.uid(), organization_id));

-- RLS policies for agent_report_rows
CREATE POLICY "Users can view org report rows"
ON public.agent_report_rows
FOR SELECT
USING (report_id IN (
  SELECT id FROM public.agent_report_data 
  WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can insert org report rows"
ON public.agent_report_rows
FOR INSERT
WITH CHECK (report_id IN (
  SELECT id FROM public.agent_report_data 
  WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can update org report rows"
ON public.agent_report_rows
FOR UPDATE
USING (report_id IN (
  SELECT id FROM public.agent_report_data 
  WHERE user_has_org_access(auth.uid(), organization_id)
));

CREATE POLICY "Users can delete org report rows"
ON public.agent_report_rows
FOR DELETE
USING (report_id IN (
  SELECT id FROM public.agent_report_data 
  WHERE user_has_org_access(auth.uid(), organization_id)
));

-- Create indexes
CREATE INDEX idx_agent_report_data_org_month_year ON public.agent_report_data(organization_id, month, year);
CREATE INDEX idx_agent_report_rows_report_id ON public.agent_report_rows(report_id);

-- Create trigger for updated_at
CREATE TRIGGER update_agent_report_data_updated_at
BEFORE UPDATE ON public.agent_report_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_report_rows_updated_at
BEFORE UPDATE ON public.agent_report_rows
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();