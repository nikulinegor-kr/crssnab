-- Создаем таблицу поставщиков
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  category TEXT NOT NULL DEFAULT 'Другое',
  status TEXT NOT NULL DEFAULT 'Активный',
  address TEXT,
  inn TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Включаем RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Политики для просмотра
CREATE POLICY "Users can view org suppliers"
  ON public.suppliers
  FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

-- Политики для создания
CREATE POLICY "Users can create org suppliers"
  ON public.suppliers
  FOR INSERT
  WITH CHECK (
    (auth.uid() = created_by) AND 
    user_has_org_access(auth.uid(), organization_id)
  );

-- Политики для обновления
CREATE POLICY "Users can update org suppliers"
  ON public.suppliers
  FOR UPDATE
  USING (user_has_org_access(auth.uid(), organization_id));

-- Политики для удаления
CREATE POLICY "Admins can delete org suppliers"
  ON public.suppliers
  FOR DELETE
  USING (user_is_org_admin(auth.uid(), organization_id));

-- Создаем индексы
CREATE INDEX idx_suppliers_organization_id ON public.suppliers(organization_id);
CREATE INDEX idx_suppliers_category ON public.suppliers(category);
CREATE INDEX idx_suppliers_status ON public.suppliers(status);

-- Триггер для обновления updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();