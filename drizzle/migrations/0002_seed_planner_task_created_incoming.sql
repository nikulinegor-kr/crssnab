CREATE OR REPLACE FUNCTION public.seed_notification_routing(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_routing_rules (organization_id, event_type, notification_type, is_enabled)
  VALUES
    (_org_id, 'request.created', 'supply', true),
    (_org_id, 'request.incoming', 'incoming', true),
    (_org_id, 'request.status_changed', 'supply', true),
    (_org_id, 'request.executor_assigned', 'supply', true),
    (_org_id, 'request.comment_added', 'supply', true),
    (_org_id, 'invoice.created', 'invoice', true),
    (_org_id, 'invoice.pay_now', 'invoice', true),
    (_org_id, 'invoice.overdue', 'invoice', false),
    (_org_id, 'invoice.payment_changed', 'invoice', false),
    (_org_id, 'supply.arrived', 'supply', true),
    (_org_id, 'supply.attachment_added', 'supply', true),
    (_org_id, 'supply.cargo_moved', 'supply', true),
    (_org_id, 'planner.task_created', 'incoming', true),
    (_org_id, 'alert.system_error', 'alert', true),
    (_org_id, 'alert.webhook_error', 'alert', true)
  ON CONFLICT DO NOTHING;
END;
$function$;