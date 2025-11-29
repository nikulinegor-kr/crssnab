-- Create table for agent act report header data
CREATE TABLE public.agent_act_report_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for agent act report calculation rows
CREATE TABLE public.agent_act_calculation_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.agent_act_report_data(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  transfer_date TEXT,
  transferred_amount NUMERIC,
  tax_7_percent NUMERIC,
  remainder_after_tax NUMERIC,
  salary_with_commission NUMERIC,
  check_amount NUMERIC,
  act_amount NUMERIC,
  formula TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for agent act additional rows
CREATE TABLE public.agent_act_additional_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.agent_act_report_data(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  description TEXT,
  amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agent_act_report_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_act_calculation_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_act_additional_rows ENABLE ROW LEVEL SECURITY;

-- Create policies for agent_act_report_data
CREATE POLICY "Users can view their organization's agent act reports"
ON public.agent_act_report_data
FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM public.user_organizations 
  WHERE organization_id = agent_act_report_data.organization_id
));

CREATE POLICY "Admins can insert agent act reports"
ON public.agent_act_report_data
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_organizations 
    WHERE organization_id = agent_act_report_data.organization_id 
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update agent act reports"
ON public.agent_act_report_data
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_organizations 
    WHERE organization_id = agent_act_report_data.organization_id 
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can delete agent act reports"
ON public.agent_act_report_data
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_organizations 
    WHERE organization_id = agent_act_report_data.organization_id 
    AND role IN ('owner', 'admin')
  )
);

-- Create policies for agent_act_calculation_rows
CREATE POLICY "Users can view calculation rows"
ON public.agent_act_calculation_rows
FOR SELECT
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can insert calculation rows"
ON public.agent_act_calculation_rows
FOR INSERT
WITH CHECK (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Admins can update calculation rows"
ON public.agent_act_calculation_rows
FOR UPDATE
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Admins can delete calculation rows"
ON public.agent_act_calculation_rows
FOR DELETE
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

-- Create policies for agent_act_additional_rows
CREATE POLICY "Users can view additional rows"
ON public.agent_act_additional_rows
FOR SELECT
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can insert additional rows"
ON public.agent_act_additional_rows
FOR INSERT
WITH CHECK (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Admins can update additional rows"
ON public.agent_act_additional_rows
FOR UPDATE
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

CREATE POLICY "Admins can delete additional rows"
ON public.agent_act_additional_rows
FOR DELETE
USING (
  report_id IN (
    SELECT id FROM public.agent_act_report_data
    WHERE organization_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_act_report_data_updated_at
BEFORE UPDATE ON public.agent_act_report_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_act_calculation_rows_updated_at
BEFORE UPDATE ON public.agent_act_calculation_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_act_additional_rows_updated_at
BEFORE UPDATE ON public.agent_act_additional_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();