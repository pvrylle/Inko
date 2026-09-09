create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create type public.note_source as enum ('voice', 'text', 'photo', 'pdf');
create type public.voice_session_status as enum ('active', 'completed', 'failed', 'deletion_pending', 'deleted');
create type public.study_rating as enum ('again', 'hard', 'good', 'easy');
create type public.focus_status as enum ('active', 'paused', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Study buddy',
  streak_count integer not null default 0 check (streak_count >= 0),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider_session_id text unique,
  status public.voice_session_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.chat_turns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  voice_session_id uuid references public.voice_sessions(id) on delete set null,
  role text not null check (role in ('student', 'inko')),
  transcript text not null check (char_length(transcript) between 1 and 20000),
  interrupted boolean not null default false,
  provider_item_id text,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '',
  content_markdown text not null check (char_length(content_markdown) between 1 and 100000),
  source public.note_source not null default 'text',
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 1000),
  back text not null check (char_length(back) between 1 and 4000),
  explanation text,
  due timestamptz not null default now(),
  stability real not null default 0,
  difficulty real not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state integer not null default 0 check (state between 0 and 3),
  last_review timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  rating public.study_rating not null,
  answer_text text,
  semantic_score real check (semantic_score between 0 and 1),
  feedback text,
  previous_due timestamptz not null,
  next_due timestamptz not null,
  reviewed_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null check (position >= 0),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  options text[] not null check (cardinality(options) = 4),
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create table private.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  correct_index integer not null check (correct_index between 0 and 3),
  explanation text not null
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_index integer not null check (selected_index between 0 and 3),
  correct boolean not null,
  feedback text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, question_id)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  started_at timestamptz not null default now(),
  target_ends_at timestamptz not null,
  paused_at timestamptz,
  accumulated_pause_seconds integer not null default 0 check (accumulated_pause_seconds >= 0),
  completed_at timestamptz,
  status public.focus_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  call_id text not null,
  tool_name text not null,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (owner_id, call_id)
);

create index profiles_last_active_idx on public.profiles(last_active_at);
create index voice_sessions_owner_created_idx on public.voice_sessions(owner_id, created_at desc);
create index voice_sessions_cleanup_idx on public.voice_sessions(status, ended_at) where status = 'deletion_pending';
create index chat_turns_owner_created_idx on public.chat_turns(owner_id, created_at desc);
create index notes_owner_created_idx on public.notes(owner_id, created_at desc);
create index notes_owner_title_idx on public.notes(owner_id, title);
create index flashcards_owner_due_idx on public.flashcards(owner_id, due);
create index flashcards_note_idx on public.flashcards(note_id);
create index flashcard_reviews_owner_created_idx on public.flashcard_reviews(owner_id, reviewed_at desc);
create index quizzes_owner_created_idx on public.quizzes(owner_id, created_at desc);
create index quiz_questions_quiz_position_idx on public.quiz_questions(quiz_id, position);
create index quiz_attempts_owner_created_idx on public.quiz_attempts(owner_id, created_at desc);
create index focus_sessions_owner_created_idx on public.focus_sessions(owner_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger flashcards_set_updated_at before update on public.flashcards for each row execute function public.set_updated_at();
create trigger focus_sessions_set_updated_at before update on public.focus_sessions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.chat_turns enable row level security;
alter table public.notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.tool_executions enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy voice_sessions_select_own on public.voice_sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy voice_sessions_insert_own on public.voice_sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy voice_sessions_update_own on public.voice_sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy voice_sessions_delete_own on public.voice_sessions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy chat_turns_select_own on public.chat_turns for select to authenticated using ((select auth.uid()) = owner_id);
create policy chat_turns_insert_own on public.chat_turns for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy chat_turns_update_own on public.chat_turns for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy chat_turns_delete_own on public.chat_turns for delete to authenticated using ((select auth.uid()) = owner_id);

create policy notes_select_own on public.notes for select to authenticated using ((select auth.uid()) = owner_id);
create policy notes_insert_own on public.notes for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy notes_update_own on public.notes for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy notes_delete_own on public.notes for delete to authenticated using ((select auth.uid()) = owner_id);

create policy flashcards_select_own on public.flashcards for select to authenticated using ((select auth.uid()) = owner_id);
create policy flashcards_insert_own on public.flashcards for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy flashcards_update_own on public.flashcards for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy flashcards_delete_own on public.flashcards for delete to authenticated using ((select auth.uid()) = owner_id);

create policy flashcard_reviews_select_own on public.flashcard_reviews for select to authenticated using ((select auth.uid()) = owner_id);
create policy flashcard_reviews_insert_own on public.flashcard_reviews for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy flashcard_reviews_update_own on public.flashcard_reviews for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy flashcard_reviews_delete_own on public.flashcard_reviews for delete to authenticated using ((select auth.uid()) = owner_id);

create policy quizzes_select_own on public.quizzes for select to authenticated using ((select auth.uid()) = owner_id);
create policy quizzes_insert_own on public.quizzes for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy quizzes_update_own on public.quizzes for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy quizzes_delete_own on public.quizzes for delete to authenticated using ((select auth.uid()) = owner_id);

create policy quiz_questions_select_own on public.quiz_questions for select to authenticated using ((select auth.uid()) = owner_id);
create policy quiz_questions_insert_own on public.quiz_questions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy quiz_questions_update_own on public.quiz_questions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy quiz_questions_delete_own on public.quiz_questions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy quiz_attempts_select_own on public.quiz_attempts for select to authenticated using ((select auth.uid()) = owner_id);
create policy quiz_attempts_insert_own on public.quiz_attempts for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy quiz_attempts_update_own on public.quiz_attempts for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy quiz_attempts_delete_own on public.quiz_attempts for delete to authenticated using ((select auth.uid()) = owner_id);

create policy focus_sessions_select_own on public.focus_sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy focus_sessions_insert_own on public.focus_sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy focus_sessions_update_own on public.focus_sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy focus_sessions_delete_own on public.focus_sessions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy tool_executions_select_own on public.tool_executions for select to authenticated using ((select auth.uid()) = owner_id);
create policy tool_executions_insert_own on public.tool_executions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy tool_executions_update_own on public.tool_executions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy tool_executions_delete_own on public.tool_executions for delete to authenticated using ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema private from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-assets', 'note-assets', false, 1048576, array['text/markdown', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy note_assets_select_own on storage.objects for select to authenticated
using (bucket_id = 'note-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy note_assets_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'note-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy note_assets_update_own on storage.objects for update to authenticated
using (bucket_id = 'note-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'note-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy note_assets_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'note-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
declare table_name text;
begin
  foreach table_name in array array['chat_turns', 'notes', 'flashcards', 'flashcard_reviews', 'quizzes', 'quiz_questions', 'quiz_attempts', 'focus_sessions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
