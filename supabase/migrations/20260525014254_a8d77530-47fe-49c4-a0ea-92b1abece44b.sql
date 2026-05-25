
CREATE OR REPLACE FUNCTION public.build_assigned_message_v2(r requests)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parts text[] := ARRAY[]::text[];
  obj_name text;
BEGIN
  SELECT name INTO obj_name FROM public.request_objects WHERE id = r.object_id;

  parts := parts || ('📌 Статус: ' || COALESCE(NULLIF(r.status,''), 'Новая заявка'))::text;
  parts := parts || ''::text;
  parts := parts || '✅ Исполнитель назначен'::text;
  parts := parts || ''::text;
  parts := parts || ('🧾 Заявка:' || E'\n' || COALESCE(NULLIF(r.description,''), 'Без названия'))::text;
  parts := parts || ''::text;
  parts := parts || ('⭐ Приоритет:' || E'\n' || COALESCE(NULLIF(r.priority::text,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🏗 Объект:' || E'\n' || COALESCE(NULLIF(obj_name,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('👤 Заявитель:' || E'\n' || COALESCE(NULLIF(r.applicant,''), '—'))::text;
  parts := parts || ''::text;
  parts := parts || ('🔧 Исполнитель:' || E'\n' || COALESCE(NULLIF(r.executor,''), '—'))::text;
  RETURN array_to_string(parts, E'\n');
END;
$function$;
