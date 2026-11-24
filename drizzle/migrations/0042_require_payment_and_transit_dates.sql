create or replace function public.validate_crss_request_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.payment_percent is not distinct from old.payment_percent
     and new.shipment_date is not distinct from old.shipment_date
     and new.delivery_date is not distinct from old.delivery_date then
    return new;
  end if;

  if new.status in ('Готов к отгрузке', 'В пути', 'Доставлено в ТК', 'Доставлено', 'В работе')
     and (new.payment_percent is null or new.payment_percent not in (50, 100)) then
    raise exception 'Для статуса «%» отметьте фактическую оплату 50%% или 100%%', new.status
      using errcode = '23514';
  end if;

  if new.status = 'В пути' and (new.shipment_date is null or new.delivery_date is null) then
    raise exception 'Для статуса «В пути» укажите дату отгрузки и дату доставки'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_crss_request_status on public.requests;
create trigger validate_crss_request_status
before insert or update of status, payment_percent, shipment_date, delivery_date on public.requests
for each row execute function public.validate_crss_request_status();
