create schema if not exists app_private;

create table app_private.crss_signup_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  consent_version text not null,
  accepted_at timestamptz not null default statement_timestamp()
);

alter table app_private.crss_signup_consents enable row level security;
revoke all on app_private.crss_signup_consents from public, anon, authenticated;

create function app_private.record_crss_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Organization registration supplies an INN. Staff invitations use a separate flow.
  if nullif(new.raw_user_meta_data ->> 'inn', '') is null then
    return new;
  end if;

  if new.raw_user_meta_data ->> 'personal_data_consent_version' is distinct from '2026-11-23' then
    raise exception 'Registration requires the current personal data consent';
  end if;

  insert into app_private.crss_signup_consents (user_id, consent_version)
  values (new.id, '2026-11-23');
  return new;
end;
$$;

revoke all on function app_private.record_crss_signup_consent() from public, anon, authenticated;

create trigger record_crss_signup_consent
after insert on auth.users
for each row execute function app_private.record_crss_signup_consent();
