DO $$ DECLARE fn record; definition text; BEGIN
FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('check_request_deadlines','check_delivery_arrived','planner_check_task_deadlines') LOOP
 definition:=pg_get_functiondef(fn.oid);
 definition:=replace(definition, 'n.link = ', 'public.normalize_notification_link(n.link) = ');
 EXECUTE definition;
END LOOP;
END; $$;