create or replace function public.enforce_planner_task_author_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  was_delegated boolean := false;
  is_delegated boolean;
begin
  if tg_op = 'UPDATE' then
    was_delegated := old.created_by is not null and old.assignee_id is not null and old.created_by <> old.assignee_id;
    if old.created_by is not null and new.created_by is distinct from old.created_by then
      raise exception 'Постановщика задачи изменить нельзя' using errcode = '23514';
    end if;
  end if;

  is_delegated := new.created_by is not null and new.assignee_id is not null and new.created_by <> new.assignee_id;
  if was_delegated and not is_delegated and actor is distinct from old.created_by then
    raise exception 'Только постановщик может снять назначение с этой задачи' using errcode = '42501';
  end if;

  if is_delegated then
    new.requires_acceptance := true;
    new.reviewer_id := new.created_by;
  end if;

  if not (is_delegated or was_delegated) or new.status not in ('done', 'rework') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if tg_op = 'INSERT' or old.status <> 'review' then
    raise exception 'Сначала передайте результат на проверку постановщику' using errcode = '23514';
  end if;
  if actor is distinct from new.created_by then
    raise exception 'Только постановщик может принять результат или вернуть задачу на доработку' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_planner_task_author_acceptance() from public, anon, authenticated;

create or replace trigger zz_planner_task_author_acceptance
before insert or update on public.planner_tasks
for each row execute function public.enforce_planner_task_author_acceptance();
