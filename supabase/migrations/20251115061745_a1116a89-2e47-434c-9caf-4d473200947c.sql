-- Создаем функцию для проверки прав на создание заявок
CREATE OR REPLACE FUNCTION public.user_can_create_requests(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin', 'editor')
  )
$$;

-- Создаем функцию для проверки прав на редактирование заявок
CREATE OR REPLACE FUNCTION public.user_can_edit_requests(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin', 'editor')
  )
$$;

-- Обновляем RLS политики для requests
DROP POLICY IF EXISTS "Users can create organization requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update organization requests" ON public.requests;

CREATE POLICY "Users can create organization requests" 
ON public.requests 
FOR INSERT 
WITH CHECK (
  (auth.uid() = created_by) AND 
  user_can_create_requests(auth.uid(), organization_id)
);

CREATE POLICY "Users can update organization requests" 
ON public.requests 
FOR UPDATE 
USING (user_can_edit_requests(auth.uid(), organization_id));