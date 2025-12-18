-- Добавляем поле applicant_user_id в таблицу requests
ALTER TABLE public.requests 
ADD COLUMN applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_requests_applicant_user_id ON public.requests(applicant_user_id);

-- Функция для проверки доступа к заявкам (editor и выше видят все, остальные - только свои)
CREATE OR REPLACE FUNCTION public.user_can_view_request(_user_id uuid, _org_id uuid, _applicant_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin', 'editor')
  )
  OR (_applicant_user_id = _user_id)
$$;

-- Удаляем старую политику для SELECT
DROP POLICY IF EXISTS "Users can view org requests" ON public.requests;

-- Новая политика: editor+ видят все, остальные - только свои
CREATE POLICY "Users can view org requests" 
ON public.requests 
FOR SELECT 
USING (
  user_has_org_access(auth.uid(), organization_id)
  AND (
    -- Editors и выше видят все заявки организации
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = requests.organization_id
        AND role IN ('owner', 'admin', 'editor')
    )
    -- Остальные видят только свои заявки
    OR applicant_user_id = auth.uid()
    -- Клиенты видят заявки связанные с ними
    OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  )
);