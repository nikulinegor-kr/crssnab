create or replace function public.enforce_request_delivery_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text := btrim(new.status);
begin
  if tg_op = 'UPDATE' and next_status is not distinct from btrim(old.status) then
    return new;
  end if;

  if next_status in ('В работе', 'Готов к отгрузке', 'В пути', 'Доставлено') and new.shipment_date is null then
    raise exception 'Для статуса «%» укажите дату отгрузки', next_status using errcode = '23514';
  end if;

  if next_status = 'В пути' then
    if new.delivery_date is null or nullif(btrim(new.transport_company), '') is null then
      raise exception 'Для статуса «В пути» укажите дату прихода и транспортную компанию' using errcode = '23514';
    end if;
    if new.delivery_date < new.shipment_date then
      raise exception 'Дата прихода не может быть раньше даты отгрузки' using errcode = '23514';
    end if;
  end if;

  if next_status <> 'Доставлено' or next_status is null then
    return new;
  end if;

  if new.actual_arrival_date is null or new.actual_arrival_date < new.shipment_date then
    raise exception 'Укажите фактическую дату прихода не раньше даты отгрузки' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.warehouse_request_receipts r
    where r.request_id = new.id and r.organization_id = new.organization_id
  ) and not exists (
    select 1
    from public.warehouse_receipt_batches b
    join public.warehouse_receipt_batch_lines l on l.batch_id = b.id
    where b.request_id = new.id and b.organization_id = new.organization_id
    having count(*) > 0 and (
      not exists (select 1 from public.request_items i where i.request_id = new.id)
      and sum(l.accepted_qty + l.defect_qty) filter (where l.request_item_id is null)
        >= max(l.expected_qty) filter (where l.request_item_id is null)
      or exists (select 1 from public.request_items i where i.request_id = new.id)
      and not exists (
        select 1 from public.request_items i
        where i.request_id = new.id and (
          i.quantity is null or i.quantity <= 0 or i.quantity > coalesce((
            select sum(lines.accepted_qty + lines.defect_qty)
            from public.warehouse_receipt_batches batches
            join public.warehouse_receipt_batch_lines lines on lines.batch_id = batches.id
            where batches.request_id = new.id and batches.organization_id = new.organization_id
              and lines.request_item_id = i.id
          ), 0)
        )
      )
    )
  ) then
    raise exception 'Необходимо осуществить полную приёмку, чтобы установить «Доставлено»' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_request_delivery_workflow() from public, anon, authenticated;

create or replace trigger enforce_request_delivery_workflow
before insert or update of status on public.requests
for each row execute function public.enforce_request_delivery_workflow();

-- Keep the existing receipt transaction, permissions and validation. Allow
-- receipt before the final delivery status, including direct warehouse pickup.
do $$
declare
  original text := pg_get_functiondef('public.receive_request_partial(uuid,uuid,uuid,uuid,jsonb,boolean)'::regprocedure);
  previous_clause constant text := $clause$r.status NOT IN ('В пути','Доставлено в ТК','Доставлено')$clause$;
  next_clause constant text := $clause$btrim(r.status) NOT IN ('В работе','Готов к отгрузке','В пути','Доставлено в ТК','Доставлено')$clause$;
begin
  if strpos(original, next_clause) > 0 then return; end if;
  if strpos(original, previous_clause) = 0 then
    raise exception 'Unexpected receipt status validation';
  end if;
  execute replace(replace(original, previous_clause, next_clause),
    'Приёмка доступна для заявок В пути, Доставлено в ТК или Доставлено',
    'Приёмка доступна для заявок в работе, готовых к отгрузке и находящихся в доставке');
end;
$$;
