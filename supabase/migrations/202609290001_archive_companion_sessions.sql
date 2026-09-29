alter table public.companion_sessions
  add column if not exists archived_at timestamptz;
