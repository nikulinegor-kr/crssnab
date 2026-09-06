
ALTER FUNCTION public.planner_status_label(text) SET search_path = public;
ALTER FUNCTION public.planner_priority_label(text) SET search_path = public;

REVOKE ALL ON FUNCTION public.planner_notify_users(uuid, uuid, text, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planner_task_log_and_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planner_comment_log_and_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planner_check_task_deadlines() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_check_task_deadlines() TO service_role;
