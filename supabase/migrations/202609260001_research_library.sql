create type public.research_status as enum ('draft', 'analyzing', 'ready', 'failed');
create type public.research_source_type as enum ('document', 'url', 'file');
create type public.research_source_tag as enum ('supports', 'contradicts', 'untagged');
create type public.research_run_status as enum ('analyzing', 'ready', 'failed');
create type public.library_file_type as enum ('pdf', 'doc', 'docx', 'txt', 'md');

create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 10 and 500),
  title text check (title is null or char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  status public.research_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index library_classes_owner_name_idx on public.library_classes (owner_id, lower(name));

create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.library_classes(id) on delete cascade,
  name text not null check (
    char_length(name) between 1 and 180
    and name !~ '[/\\]'
    and position('..' in name) = 0
    and name !~ '[[:cntrl:]]'
  ),
  type public.library_file_type not null,
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  storage_path text not null check (
    char_length(storage_path) between 1 and 500
    and storage_path like (owner_id::text || '/%')
    and position('..' in storage_path) = 0
  ),
  upload_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text check (url is null or char_length(url) between 1 and 2000),
  type public.research_source_type not null,
  tag public.research_source_tag not null default 'untagged',
  library_file_id uuid references public.library_files(id) on delete set null,
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 80000),
  meta text check (meta is null or char_length(meta) <= 200),
  created_at timestamptz not null default now()
);

create unique index research_sources_session_file_idx
  on public.research_sources (session_id, library_file_id)
  where library_file_id is not null;

create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  statement text not null check (char_length(statement) between 1 and 2000),
  source_id uuid references public.research_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.research_contradictions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  explanation text not null check (char_length(explanation) between 1 and 2000),
  source_ids uuid[] not null check (cardinality(source_ids) >= 2),
  created_at timestamptz not null default now()
);

create table public.research_open_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.research_canvas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 50000),
  updated_at timestamptz not null default now(),
  unique (owner_id, session_id)
);

create table public.research_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_markdown text not null check (char_length(content_markdown) between 1 and 100000),
  updated_at timestamptz not null default now(),
  unique (owner_id, session_id)
);

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status public.research_run_status not null default 'analyzing',
  error text check (error is null or char_length(error) <= 80),
  input_hash text check (input_hash is null or char_length(input_hash) <= 128),
  call_id text check (call_id is null or char_length(call_id) between 6 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index research_runs_owner_call_idx on public.research_runs (owner_id, call_id) where call_id is not null;
create index research_sessions_owner_updated_idx on public.research_sessions (owner_id, updated_at desc);
create index research_sources_owner_session_idx on public.research_sources (owner_id, session_id, created_at);
create index research_findings_session_idx on public.research_findings (session_id, created_at);
create index research_contradictions_session_idx on public.research_contradictions (session_id, created_at);
create index research_open_questions_session_idx on public.research_open_questions (session_id, created_at);
create index research_runs_session_idx on public.research_runs (session_id, created_at desc);
create index library_files_owner_uploaded_idx on public.library_files (owner_id, upload_date desc);
create index library_files_class_idx on public.library_files (class_id);

create trigger research_sessions_set_updated_at before update on public.research_sessions for each row execute function public.set_updated_at();
create trigger research_canvas_set_updated_at before update on public.research_canvas for each row execute function public.set_updated_at();
create trigger research_notes_set_updated_at before update on public.research_notes for each row execute function public.set_updated_at();
create trigger research_runs_set_updated_at before update on public.research_runs for each row execute function public.set_updated_at();

create or replace function public.enforce_library_file_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  class_count integer;
  owner_count integer;
begin
  if not exists (
    select 1 from public.library_classes
    where id = new.class_id and owner_id = new.owner_id
  ) then
    raise exception 'CLASS_NOT_OWNED';
  end if;

  select count(*) into class_count from public.library_files where class_id = new.class_id and id <> new.id;
  if class_count >= 40 then raise exception 'CLASS_FILE_QUOTA'; end if;

  select count(*) into owner_count from public.library_files where owner_id = new.owner_id and id <> new.id;
  if owner_count >= 200 then raise exception 'OWNER_FILE_QUOTA'; end if;

  return new;
end;
$$;

create trigger library_files_enforce_owner before insert or update on public.library_files
for each row execute function public.enforce_library_file_owner();

create or replace function public.enforce_research_source_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.research_sessions
    where id = new.session_id and owner_id = new.owner_id
  ) then
    raise exception 'SESSION_NOT_OWNED';
  end if;

  if new.library_file_id is not null and not exists (
    select 1 from public.library_files
    where id = new.library_file_id and owner_id = new.owner_id
  ) then
    raise exception 'FILE_NOT_OWNED';
  end if;

  return new;
end;
$$;

create trigger research_sources_enforce_owner before insert or update on public.research_sources
for each row execute function public.enforce_research_source_owner();

create or replace function public.touch_research_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_session uuid := coalesce(new.session_id, old.session_id);
begin
  update public.research_sessions set updated_at = now() where id = target_session;
  return coalesce(new, old);
end;
$$;

create trigger research_sources_touch_session
after insert or update or delete on public.research_sources
for each row execute function public.touch_research_session();

create or replace function public.begin_research_analysis(
  p_owner_id uuid,
  p_session_id uuid,
  p_input_hash text,
  p_call_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.research_sessions%rowtype;
  run_row public.research_runs%rowtype;
  source_count integer;
begin
  select * into session_row from public.research_sessions
  where id = p_session_id and owner_id = p_owner_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  if p_call_id is not null then
    select * into run_row from public.research_runs
    where owner_id = p_owner_id and call_id = p_call_id;
    if found then
      return jsonb_build_object('run', to_jsonb(run_row), 'reused', true);
    end if;
  end if;

  select * into run_row from public.research_runs
  where session_id = p_session_id and owner_id = p_owner_id and status = 'analyzing'
  order by created_at desc
  limit 1;

  if found and run_row.updated_at > now() - interval '3 minutes' then
    return jsonb_build_object('run', to_jsonb(run_row), 'reused', true);
  end if;

  if found then
    update public.research_runs
    set status = 'failed', error = 'STALE_RUN', updated_at = now()
    where id = run_row.id;
  end if;

  select count(*) into source_count from public.research_sources
  where session_id = p_session_id and owner_id = p_owner_id;
  if source_count < 1 then raise exception 'NO_SOURCES'; end if;

  insert into public.research_runs (owner_id, session_id, status, input_hash, call_id)
  values (p_owner_id, p_session_id, 'analyzing', p_input_hash, p_call_id)
  returning * into run_row;

  update public.research_sessions
  set status = 'analyzing', updated_at = now()
  where id = p_session_id and owner_id = p_owner_id;

  return jsonb_build_object('run', to_jsonb(run_row), 'reused', false);
end;
$$;

create or replace function public.replace_research_analysis(
  p_owner_id uuid,
  p_session_id uuid,
  p_run_id uuid,
  p_description text,
  p_note_markdown text,
  p_findings jsonb,
  p_contradictions jsonb,
  p_questions jsonb,
  p_source_tags jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  finding_item jsonb;
  contradiction_item jsonb;
  question_item jsonb;
  tag_item jsonb;
  kept_sources uuid[];
  matched uuid[];
  finding_count integer := 0;
  contradiction_count integer := 0;
  question_count integer := 0;
begin
  if not exists (
    select 1 from public.research_runs
    where id = p_run_id and session_id = p_session_id and owner_id = p_owner_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if char_length(coalesce(p_description, '')) > 1000 then raise exception 'INVALID_DESCRIPTION'; end if;
  if char_length(coalesce(p_note_markdown, '')) not between 1 and 100000 then raise exception 'INVALID_NOTE'; end if;

  select coalesce(array_agg(id), '{}') into kept_sources
  from public.research_sources
  where session_id = p_session_id and owner_id = p_owner_id;

  delete from public.research_findings where session_id = p_session_id and owner_id = p_owner_id;
  delete from public.research_contradictions where session_id = p_session_id and owner_id = p_owner_id;
  delete from public.research_open_questions where session_id = p_session_id and owner_id = p_owner_id;

  for finding_item in select value from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb))
  loop
    if char_length(btrim(finding_item->>'statement')) not between 1 and 2000 then continue; end if;
    if finding_item->>'source_id' is not null and (
      (finding_item->>'source_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not ((finding_item->>'source_id')::uuid = any(kept_sources))
    ) then continue; end if;
    insert into public.research_findings (owner_id, session_id, statement, source_id)
    values (
      p_owner_id,
      p_session_id,
      btrim(finding_item->>'statement'),
      case when finding_item->>'source_id' is null then null else (finding_item->>'source_id')::uuid end
    );
    finding_count := finding_count + 1;
  end loop;

  for contradiction_item in select value from jsonb_array_elements(coalesce(p_contradictions, '[]'::jsonb))
  loop
    if char_length(btrim(contradiction_item->>'explanation')) not between 1 and 2000 then continue; end if;
    select coalesce(array_agg(distinct source_id), '{}') into matched
    from (
      select (item.value)::uuid as source_id
      from jsonb_array_elements_text(coalesce(contradiction_item->'source_ids', '[]'::jsonb)) as item(value)
      where item.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) as incoming
    where source_id = any(kept_sources);
    if matched is null or cardinality(matched) < 2 then continue; end if;
    insert into public.research_contradictions (owner_id, session_id, explanation, source_ids)
    values (p_owner_id, p_session_id, btrim(contradiction_item->>'explanation'), matched);
    contradiction_count := contradiction_count + 1;
  end loop;

  for question_item in select value from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb))
  loop
    if char_length(btrim(question_item->>'text')) not between 1 and 500 then continue; end if;
    insert into public.research_open_questions (owner_id, session_id, text)
    values (p_owner_id, p_session_id, btrim(question_item->>'text'));
    question_count := question_count + 1;
  end loop;

  for tag_item in select value from jsonb_array_elements(coalesce(p_source_tags, '[]'::jsonb))
  loop
    if (tag_item->>'id') is null or not ((tag_item->>'id')::uuid = any(kept_sources)) then continue; end if;
    if (tag_item->>'tag') not in ('supports', 'contradicts') then continue; end if;
    update public.research_sources
    set tag = (tag_item->>'tag')::public.research_source_tag
    where id = (tag_item->>'id')::uuid and session_id = p_session_id and owner_id = p_owner_id;
  end loop;

  insert into public.research_notes (owner_id, session_id, content_markdown)
  values (p_owner_id, p_session_id, btrim(p_note_markdown))
  on conflict (owner_id, session_id) do update
  set content_markdown = excluded.content_markdown, updated_at = now();

  update public.research_sessions
  set description = btrim(coalesce(p_description, '')), status = 'ready', updated_at = now()
  where id = p_session_id and owner_id = p_owner_id;

  update public.research_runs
  set status = 'ready', error = null, updated_at = now()
  where id = p_run_id and owner_id = p_owner_id;

  return jsonb_build_object(
    'status', 'ready',
    'findings', finding_count,
    'contradictions', contradiction_count,
    'openQuestions', question_count
  );
end;
$$;

create or replace function public.fail_research_run(
  p_owner_id uuid,
  p_session_id uuid,
  p_run_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.research_runs
  set status = 'failed', error = left(coalesce(p_error, 'ANALYSIS_FAILED'), 80), updated_at = now()
  where id = p_run_id and session_id = p_session_id and owner_id = p_owner_id;

  update public.research_sessions
  set status = 'failed', updated_at = now()
  where id = p_session_id and owner_id = p_owner_id and status = 'analyzing';

  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.begin_research_analysis(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.replace_research_analysis(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fail_research_run(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_research_analysis(uuid, uuid, text, text) to service_role;
grant execute on function public.replace_research_analysis(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.fail_research_run(uuid, uuid, uuid, text) to service_role;

alter table public.research_sessions enable row level security;
alter table public.library_classes enable row level security;
alter table public.library_files enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_findings enable row level security;
alter table public.research_contradictions enable row level security;
alter table public.research_open_questions enable row level security;
alter table public.research_canvas enable row level security;
alter table public.research_notes enable row level security;
alter table public.research_runs enable row level security;

create policy research_sessions_select_own on public.research_sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_sessions_insert_own on public.research_sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_sessions_update_own on public.research_sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_sessions_delete_own on public.research_sessions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy library_classes_select_own on public.library_classes for select to authenticated using ((select auth.uid()) = owner_id);
create policy library_classes_insert_own on public.library_classes for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy library_classes_update_own on public.library_classes for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy library_classes_delete_own on public.library_classes for delete to authenticated using ((select auth.uid()) = owner_id);

create policy library_files_select_own on public.library_files for select to authenticated using ((select auth.uid()) = owner_id);
create policy library_files_insert_own on public.library_files for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy library_files_update_own on public.library_files for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy library_files_delete_own on public.library_files for delete to authenticated using ((select auth.uid()) = owner_id);

create policy research_sources_select_own on public.research_sources for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_sources_insert_own on public.research_sources for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_sources_update_own on public.research_sources for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_sources_delete_own on public.research_sources for delete to authenticated using ((select auth.uid()) = owner_id);

create policy research_findings_select_own on public.research_findings for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_contradictions_select_own on public.research_contradictions for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_open_questions_select_own on public.research_open_questions for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_notes_select_own on public.research_notes for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_runs_select_own on public.research_runs for select to authenticated using ((select auth.uid()) = owner_id);

create policy research_canvas_select_own on public.research_canvas for select to authenticated using ((select auth.uid()) = owner_id);
create policy research_canvas_insert_own on public.research_canvas for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy research_canvas_update_own on public.research_canvas for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy research_canvas_delete_own on public.research_canvas for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.research_findings from anon, authenticated;
revoke all on public.research_contradictions from anon, authenticated;
revoke all on public.research_open_questions from anon, authenticated;
revoke all on public.research_notes from anon, authenticated;
revoke all on public.research_runs from anon, authenticated;
grant select on public.research_findings to authenticated;
grant select on public.research_contradictions to authenticated;
grant select on public.research_open_questions to authenticated;
grant select on public.research_notes to authenticated;
grant select on public.research_runs to authenticated;

revoke all on public.research_sources from anon, authenticated;
grant select (id, session_id, owner_id, title, url, type, tag, library_file_id, meta, created_at) on public.research_sources to authenticated;
grant insert (session_id, owner_id, title, url, type, tag, library_file_id, meta) on public.research_sources to authenticated;
grant update (title, url, type, tag, meta) on public.research_sources to authenticated;
grant delete on public.research_sources to authenticated;

create view public.research_sources_public
with (security_invoker = true) as
select id, session_id, owner_id, title, url, type, tag, library_file_id, meta, created_at
from public.research_sources;

grant select on public.research_sources_public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-files',
  'library-files',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy library_files_storage_select_own on storage.objects for select to authenticated
using (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy library_files_storage_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'library-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
declare table_name text;
begin
  foreach table_name in array array['research_sessions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
