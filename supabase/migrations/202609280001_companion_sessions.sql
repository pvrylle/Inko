create table public.companion_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (char_length(btrim(title)) between 1 and 160),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  research_session_id uuid references public.research_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companion_sessions_owner_updated_idx
  on public.companion_sessions (owner_id, updated_at desc);

create trigger companion_sessions_set_updated_at
  before update on public.companion_sessions
  for each row execute function public.set_updated_at();

create or replace function public.enforce_companion_research_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.research_session_id is not null and not exists (
    select 1 from public.research_sessions
    where id = new.research_session_id and owner_id = new.owner_id
  ) then
    raise exception 'RESEARCH_SESSION_NOT_OWNED';
  end if;
  return new;
end;
$$;

create trigger companion_sessions_enforce_research_owner
  before insert or update of research_session_id, owner_id on public.companion_sessions
  for each row execute function public.enforce_companion_research_owner();

alter table public.companion_sessions enable row level security;

create policy companion_sessions_select_own on public.companion_sessions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy companion_sessions_insert_own on public.companion_sessions
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy companion_sessions_update_own on public.companion_sessions
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy companion_sessions_delete_own on public.companion_sessions
  for delete to authenticated using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.companion_sessions to authenticated;
