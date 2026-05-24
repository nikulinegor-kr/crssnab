CREATE OR REPLACE FUNCTION public.build_request_message_by_id(_request_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.requests;
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN public.build_request_message(r);
END;
$function$;