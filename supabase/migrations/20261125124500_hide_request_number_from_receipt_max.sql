create or replace function public.queue_warehouse_receipt_max()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id text;
  target_group_name text;
  group_count bigint;
  warehouse_name text;
  request_description text;
begin
  select min(g.group_id), min(g.group_name), count(distinct g.group_id)
    into target_group_id, target_group_name, group_count
  from public.max_groups g
  where g.organization_id = new.organization_id
    and g.is_active
    and lower(btrim(g.group_name)) in (
      'поставка тмц', 'поставки тмц',
      'сахаресурс | поставка тмц', 'сахаресурс | поставки тмц'
    );

  if group_count <> 1 then
    raise warning 'MAX warehouse receipt %: expected one active supply group, found %', new.id, group_count;
    return new;
  end if;

  select w.name, r.description
    into warehouse_name, request_description
  from public.warehouses w
  join public.requests r on r.id = new.request_id and r.organization_id = w.organization_id
  where w.id = new.warehouse_id and w.organization_id = new.organization_id;
  if not found then
    raise warning 'MAX warehouse receipt %: request or warehouse is missing', new.id;
    return new;
  end if;

  insert into public.notification_queue (
    organization_id, event_type, entity_type, entity_id, platform, group_id, group_name, payload
  )
  values (
    new.organization_id, 'warehouse.receipt_posted', 'warehouse_receipt_batch', new.id::text,
    'max', target_group_id, target_group_name,
    jsonb_build_object('text', concat_ws(E'\n',
      'Приёмка на склад',
      coalesce(nullif(btrim(request_description), ''), 'Заявка без названия'),
      'Принял: ' || new.receiver_name,
      'Когда: ' || to_char(new.created_at at time zone 'Asia/Novosibirsk', 'DD.MM.YYYY HH24:MI') || ' (НСК)',
      'Склад: ' || warehouse_name
    ), 'request_id', new.request_id)
  );
  return new;
end;
$$;

revoke all on function public.queue_warehouse_receipt_max() from public, anon, authenticated;

create or replace trigger queue_warehouse_receipt_max
after insert on public.warehouse_receipt_batches
for each row execute function public.queue_warehouse_receipt_max();
