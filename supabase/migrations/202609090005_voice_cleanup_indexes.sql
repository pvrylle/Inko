create index if not exists voice_sessions_pending_retry_idx
on public.voice_sessions(deletion_requested_at)
where status = 'deletion_pending';

create index if not exists voice_sessions_stale_active_idx
on public.voice_sessions(started_at)
where status = 'active';
