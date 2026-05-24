CREATE OR REPLACE FUNCTION public.build_incoming_message_v2(r requests)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parts text[] := ARRAY[]::text[];
  obj_name text;
BEGIN
  SELECT name INTO obj_name FROM public.material_objects WHERE id = r.object_id;

  parts := parts || '🧾 Входящая заявка'::text;
  parts := parts || ''::text;
  parts := parts || ('Название:' || E'\n' || COALESCE(NULLIF(r.description,''), '#' || r.request_number))::text;
  parts := parts || ''::text;
  parts := parts || ('⭐ Приоритет:' || E'\n' || COALESCE(NULLIF(r.priority::text,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏗 Объект:' || E'\n' || COALESCE(NULLIF(obj_name,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель:' || E'\n' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  IF r.comments IS NOT NULL AND r.comments <> '' THEN
    parts := parts || ''::text;
    parts := parts || ('💬 Комментарий:' || E'\n' || r.comments)::text;
  END IF;
  RETURN array_to_string(parts, E'\n');
END;
$function$;