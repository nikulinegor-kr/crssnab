create table public.director_invoice_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decided_by uuid references auth.users(id) on delete set null,
  signer_name text not null,
  action text not null check (action in ('pay', 'service', 'rework')),
  comment text,
  document_path text,
  decided_at timestamptz not null default clock_timestamp(),
  notification_id uuid references public.notification_queue(id) on delete set null
);
create index director_invoice_decisions_org_recent
  on public.director_invoice_decisions (organization_id, decided_at desc);
create index director_invoice_decisions_request
  on public.director_invoice_decisions (request_id);
alter table public.director_invoice_decisions enable row level security;
revoke all on public.director_invoice_decisions from public, anon, authenticated;
grant select on public.director_invoice_decisions to authenticated;

create function public.can_approve_crss_invoices(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_organizations membership
    where membership.organization_id = org_id
      and membership.user_id = auth.uid() and membership.is_active
      and (
        membership.role in ('owner', 'admin')
        or (
          membership.role = 'editor'
          and exists (select 1 from public.user_permissions p
            where p.organization_id = org_id and p.user_id = auth.uid()
              and p.permission_key = 'analytics.executive' and p.allowed)
          and not exists (select 1 from public.user_permissions p
            where p.organization_id = org_id and p.user_id = auth.uid()
              and p.permission_key = 'analytics' and not p.allowed)
        )
      )
  );
$$;
revoke all on function public.can_approve_crss_invoices(uuid) from public, anon;
grant execute on function public.can_approve_crss_invoices(uuid) to authenticated;

create policy "Approvers see their decisions"
on public.director_invoice_decisions for select to authenticated
using (public.can_approve_crss_invoices(organization_id));

create function public.decide_crss_invoice(
  request_key uuid, decision text, source_document text, stamped_path text, revision_comment text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  request_row public.requests%rowtype;
  target_name text;
  target_id text;
  target_count integer;
  document_path text;
  approved_url text;
  signer text;
  message text;
  event_id uuid;
  decision_id uuid;
begin
  if decision is null or decision not in ('pay', 'service', 'rework') then
    raise exception 'Неизвестное решение';
  end if;

  select * into request_row from public.requests where id = request_key for update;
  if not found or not public.can_approve_crss_invoices(request_row.organization_id) then
    raise exception 'Нет доступа к согласованию счёта' using errcode = '42501';
  end if;
  if request_row.status is null or request_row.status not in ('Счёт на оплату', 'Счет на оплату')
     or request_row.invoice_routing is not null then
    raise exception 'Счёт уже обработан или его статус изменился';
  end if;

  select nullif(btrim(full_name), '') into signer from public.profiles where id = auth.uid();
  if signer is null then
    raise exception 'Заполните ФИО в профиле перед согласованием';
  end if;

  target_name := case when decision = 'rework' then 'Поставка ТМЦ' else 'СахаРесурс | Счета на оплату' end;
  select min(group_id), count(distinct group_id) into target_id, target_count
  from public.max_groups
  where organization_id = request_row.organization_id and is_active
    and (btrim(group_name) = target_name or (decision = 'rework' and btrim(group_name) = 'СахаРесурс | Поставка ТМЦ'));
  if target_count <> 1 then
    raise exception 'Проверьте единственную активную группу MAX «%» в настройках организации', target_name;
  end if;

  if decision = 'rework' then
    revision_comment := nullif(btrim(revision_comment), '');
    if revision_comment is null or char_length(revision_comment) > 1000 then
      raise exception 'Укажите, что исправить, до 1000 символов';
    end if;
    update public.requests
    set status = 'На доработке',
      comments = concat_ws(E'\n\n', nullif(comments, ''),
        '[На доработке · ' || signer || '] ' || revision_comment)
    where id = request_key;
  else
    if nullif(btrim(request_row.invoice_number), '') is null or request_row.amount is null then
      raise exception 'Заполните номер и сумму счёта';
    end if;
    if source_document is null or not (
      source_document is not distinct from request_row.document_url
      or coalesce(source_document = any(request_row.document_urls), false)
    ) then
      raise exception 'Файл счёта изменился. Обновите страницу';
    end if;
    if decision = 'pay' then
      document_path := stamped_path;
      if document_path is null or split_part(document_path, '/', 1) <> request_key::text
         or split_part(document_path, '/', 2) !~ '^approval-[0-9a-f-]{36}-ZRS\.pdf$'
         or split_part(document_path, '/', 3) <> '' or not exists (
          select 1 from storage.objects o where o.bucket_id = 'request-documents'
            and o.name = document_path and o.owner_id = auth.uid()::text
         ) then
        raise exception 'Подписанный PDF не найден';
      end if;
      approved_url := regexp_replace(source_document, '/request-documents/[^?]+.*$', '/request-documents/' || document_path);
      if approved_url is not distinct from source_document then
        raise exception 'Файл счёта должен быть прикреплён к заявке';
      end if;
    else
      document_path := split_part(split_part(source_document, '/request-documents/', 2), '?', 1);
      if document_path is null or document_path = '' then
        raise exception 'Файл счёта должен быть прикреплён к заявке';
      end if;
    end if;
    update public.requests set invoice_routing = case when decision = 'pay' then 'payment' else 'to' end,
      invoice_routed_at = clock_timestamp(), invoice_routed_by = auth.uid(),
      document_url = coalesce(approved_url, document_url),
      document_urls = case when approved_url is null then document_urls
        else array_append(coalesce(document_urls, array[]::text[]), approved_url) end
    where id = request_key;
  end if;

  message := concat_ws(E'\n', case decision when 'pay' then 'В ОПЛАТУ' when 'service' then 'В ТО' else 'На доработку' end,
    request_row.description, 'Счёт № ' || request_row.invoice_number, request_row.contractor,
    case when request_row.amount is not null then request_row.amount::text || ' ₽' end,
    signer, case when decision = 'rework' then revision_comment end);
  insert into public.notification_queue (organization_id, event_type, entity_type, entity_id, platform, group_id, group_name, payload)
  values (request_row.organization_id, 'director.invoice.' || decision, 'request', request_key::text,
    'max', target_id, target_name, jsonb_build_object('text', message, 'request_id', request_key, 'director_document_path', document_path))
  returning id into event_id;
  insert into public.director_invoice_decisions (
    request_id, organization_id, decided_by, signer_name, action, comment, document_path, notification_id
  ) values (request_key, request_row.organization_id, auth.uid(), signer, decision,
    case when decision = 'rework' then revision_comment end, document_path, event_id)
  returning id into decision_id;
  return decision_id;
end;
$$;
revoke all on function public.decide_crss_invoice(uuid,text,text,text,text) from public, anon;
grant execute on function public.decide_crss_invoice(uuid,text,text,text,text) to authenticated;

insert into public.request_statuses (organization_id, name, color, "order")
select organization.id, targets.name, targets.color, coalesce(max(existing."order"), 0) + targets.step
from public.organizations organization
cross join (values ('Счёт на оплату', '#b7791f', 1), ('На доработке', '#b45309', 2)) targets(name, color, step)
left join public.request_statuses existing on existing.organization_id = organization.id
group by organization.id, targets.name, targets.color, targets.step
having not bool_or(coalesce(existing.name = targets.name, false))
on conflict do nothing;
