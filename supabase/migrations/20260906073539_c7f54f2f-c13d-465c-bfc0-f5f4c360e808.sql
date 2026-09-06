ALTER TABLE public.user_organizations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS planner_access boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_manage_tasks boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.user_has_org_access(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
      AND role IN ('owner', 'admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_has_org_role(_user_id uuid, _org_id uuid, _role organization_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_can_create_requests(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_can_edit_requests(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
      AND role IN ('owner', 'admin', 'editor')
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_can_view_request(_user_id uuid, _org_id uuid, _applicant_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
      AND role IN ('owner', 'admin', 'editor')
  )
  OR (_applicant_user_id = _user_id AND public.user_has_org_access(_user_id, _org_id))
$function$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _org_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT public.user_has_org_access(_user_id, _org_id) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = _user_id AND organization_id = _org_id AND is_active AND role IN ('owner', 'admin')
    ) THEN true
    ELSE COALESCE(
      (SELECT allowed FROM public.user_permissions
       WHERE user_id = _user_id AND organization_id = _org_id AND permission_key = _permission_key),
      false
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.user_has_planner_access(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
      AND (planner_access OR role IN ('owner','admin'))
  )
$function$;

CREATE OR REPLACE FUNCTION public.user_can_manage_tasks(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND is_active
      AND (role IN ('owner','admin') OR (planner_access AND can_manage_tasks))
  )
$function$;

CREATE OR REPLACE FUNCTION public.validate_planner_assignee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT public.user_has_planner_access(NEW.assignee_id, NEW.organization_id) THEN
    RAISE EXCEPTION 'Нельзя назначить задачу: сотрудник неактивен или не имеет доступа к планировщику';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_planner_assignee_trg ON public.planner_tasks;
CREATE TRIGGER validate_planner_assignee_trg
BEFORE INSERT OR UPDATE OF assignee_id ON public.planner_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_planner_assignee();

REVOKE ALL ON FUNCTION public.user_has_planner_access(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.user_can_manage_tasks(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_has_planner_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_manage_tasks(uuid, uuid) TO authenticated, service_role;