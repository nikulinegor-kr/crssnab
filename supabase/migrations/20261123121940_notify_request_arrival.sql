CREATE OR REPLACE FUNCTION public.notify_request_actual_arrival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_link text := '/requests?request=' || NEW.id::text;
  request_title text := coalesce(
    nullif(btrim(NEW.description, E' \n\r\t'), ''),
    nullif(btrim(NEW.request_number, E' \n\r\t'), ''),
    'Заявка'
  );
BEGIN
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, link)
  SELECT membership.user_id, NEW.organization_id, 'request_arrived', 'Приход по заявке', request_title, request_link
  FROM public.user_organizations AS membership
  WHERE membership.organization_id = NEW.organization_id
    AND membership.is_active
    AND (membership.user_id = NEW.created_by OR membership.role IN ('owner', 'admin', 'editor'))
    AND (
      public.user_can_view_request(membership.user_id, NEW.organization_id, NEW.applicant_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.clients AS client
        WHERE client.id = NEW.client_id
          AND client.organization_id = NEW.organization_id
          AND client.user_id = membership.user_id
          AND client.is_active
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications AS prior
      WHERE prior.user_id = membership.user_id
        AND prior.organization_id = NEW.organization_id
        AND prior.type = 'request_arrived'
        AND prior.link = request_link
    );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_request_actual_arrival() FROM PUBLIC, anon, authenticated;

-- The existing BEFORE trigger can set actual_arrival_date on a status-only update.
CREATE OR REPLACE TRIGGER trg_notify_request_actual_arrival
AFTER UPDATE ON public.requests
FOR EACH ROW
WHEN (OLD.actual_arrival_date IS NULL AND NEW.actual_arrival_date IS NOT NULL)
EXECUTE FUNCTION public.notify_request_actual_arrival();
