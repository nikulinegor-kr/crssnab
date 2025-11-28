-- Переименовываем существующие таблицы для "Отчет агента - УУ"
ALTER TABLE agent_report_data RENAME TO agent_report_uu_data;
ALTER TABLE agent_report_rows RENAME TO agent_report_uu_rows;

-- Переименовываем внешние ключи
ALTER TABLE agent_report_uu_rows 
  DROP CONSTRAINT agent_report_rows_report_id_fkey;

ALTER TABLE agent_report_uu_rows 
  ADD CONSTRAINT agent_report_uu_rows_report_id_fkey 
  FOREIGN KEY (report_id) 
  REFERENCES agent_report_uu_data(id) 
  ON DELETE CASCADE;

-- Создаем таблицы для "Отчет агента" (обычная версия)
CREATE TABLE IF NOT EXISTS public.agent_report_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  report_number TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  contract_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  company_address TEXT,
  company_phone TEXT,
  recipient_position TEXT,
  recipient_name TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_report_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES agent_report_data(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  tmc TEXT,
  contractor TEXT,
  invoice_number TEXT,
  amount NUMERIC DEFAULT 0,
  formula TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_report_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_report_rows ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_report_data
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

-- Create RLS policies for agent_report_rows
CREATE POLICY "Users can view org report rows"
  ON public.agent_report_rows
  FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM agent_report_data 
      WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can insert org report rows"
  ON public.agent_report_rows
  FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM agent_report_data 
      WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update org report rows"
  ON public.agent_report_rows
  FOR UPDATE
  USING (
    report_id IN (
      SELECT id FROM agent_report_data 
      WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can delete org report rows"
  ON public.agent_report_rows
  FOR DELETE
  USING (
    report_id IN (
      SELECT id FROM agent_report_data 
      WHERE user_has_org_access(auth.uid(), organization_id)
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_agent_report_data_updated_at
  BEFORE UPDATE ON public.agent_report_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_report_rows_updated_at
  BEFORE UPDATE ON public.agent_report_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();