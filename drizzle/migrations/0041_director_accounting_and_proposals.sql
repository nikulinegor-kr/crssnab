create or replace function public.decide_crss_invoice(
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
  if request_row.archived or request_row.status is null
     or replace(lower(btrim(request_row.status)), 'ё', 'е') not in ('счет на оплату', 'счет в бухгалтерии')
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

create or replace function public.decide_crss_proposal(request_key uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request_row public.requests%rowtype;
  next_status text;
  next_color text;
begin
  select * into request_row from public.requests where id = request_key for update;
  if not found or not public.can_approve_crss_invoices(request_row.organization_id) then
    raise exception 'Нет доступа к коммерческому предложению' using errcode = '42501';
  end if;
  if request_row.archived or request_row.status is null
     or replace(lower(btrim(request_row.status)), 'ё', 'е') not in ('кп', 'коммерческое предложение') then
    raise exception 'Предложение уже обработано или его статус изменился';
  end if;

  case decision
    when 'work' then next_status := 'В работе'; next_color := '#2563eb';
    when 'reject' then next_status := 'Отклонено'; next_color := '#b91c1c';
    when 'alternative' then next_status := 'Поиск альтернативы'; next_color := '#b45309';
    else raise exception 'Неизвестное решение по предложению';
  end case;

  insert into public.request_statuses (organization_id, name, color, "order")
  select request_row.organization_id, next_status, next_color, coalesce(max(s."order"), 0) + 1
  from public.request_statuses s where s.organization_id = request_row.organization_id
  having not bool_or(coalesce(s.name = next_status, false)) or count(*) = 0
  on conflict do nothing;

  update public.requests
  set status = next_status, archived = decision = 'reject'
  where id = request_key;
end;
$$;
revoke all on function public.decide_crss_proposal(uuid,text) from public, anon;
grant execute on function public.decide_crss_proposal(uuid,text) to authenticated;
