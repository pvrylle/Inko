with ranked_open_sessions as (
  select id, row_number() over (partition by owner_id order by created_at desc, id desc) as position
  from public.focus_sessions
  where status in ('active', 'paused')
)
update public.focus_sessions
set status = 'cancelled', paused_at = null, completed_at = null
where id in (select id from ranked_open_sessions where position > 1);

create unique index if not exists focus_sessions_one_open_per_owner_idx
on public.focus_sessions(owner_id)
where status in ('active', 'paused');

alter table public.focus_sessions
  add constraint focus_sessions_target_after_start check (target_ends_at >= started_at),
  add constraint focus_sessions_state_shape check (
    (status = 'active' and paused_at is null and completed_at is null) or
    (status = 'paused' and paused_at is not null and completed_at is null) or
    (status = 'completed' and paused_at is null and completed_at is not null) or
    (status = 'cancelled' and paused_at is null and completed_at is null)
  );

drop policy if exists focus_sessions_insert_own on public.focus_sessions;
drop policy if exists focus_sessions_update_own on public.focus_sessions;
drop policy if exists focus_sessions_delete_own on public.focus_sessions;
revoke insert, update, delete on public.focus_sessions from authenticated;

create or replace function public.start_focus_session(p_duration_minutes integer, p_call_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  server_now timestamptz := clock_timestamp();
  previous_result jsonb;
  session_row public.focus_sessions%rowtype;
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_duration_minutes not between 1 and 180 then raise exception 'INVALID_FOCUS_DURATION'; end if;
  perform 1 from public.profiles where id = current_owner for update;

  if p_call_id is not null then
    select execution.result into previous_result from public.tool_executions as execution
    where execution.owner_id = current_owner and execution.call_id = p_call_id and execution.tool_name = 'start_focus_session';
    if found and previous_result is not null then return previous_result; end if;
  end if;

  update public.focus_sessions
  set status = 'completed', completed_at = target_ends_at, paused_at = null
  where owner_id = current_owner and status = 'active' and target_ends_at <= server_now;

  select * into session_row from public.focus_sessions
  where owner_id = current_owner and status in ('active', 'paused')
  order by created_at desc limit 1 for update;

  if found then
    result := jsonb_build_object('session', to_jsonb(session_row), 'transition', 'already_open', 'persisted', true, 'server_now', server_now);
  else
    insert into public.focus_sessions (owner_id, duration_minutes, started_at, target_ends_at)
    values (current_owner, p_duration_minutes, server_now, server_now + make_interval(mins => p_duration_minutes))
    returning * into session_row;
    result := jsonb_build_object('session', to_jsonb(session_row), 'transition', 'started', 'persisted', true, 'server_now', server_now);
  end if;

  if p_call_id is not null then
    insert into public.tool_executions (owner_id, call_id, tool_name, result)
    values (current_owner, p_call_id, 'start_focus_session', result);
  end if;
  return result;
end;
$$;

create or replace function public.control_focus_timer(p_action text, p_call_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  server_now timestamptz := clock_timestamp();
  previous_result jsonb;
  session_row public.focus_sessions%rowtype;
  pause_seconds integer;
  transition text;
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_action not in ('pause', 'resume', 'stop', 'complete') then raise exception 'INVALID_FOCUS_ACTION'; end if;
  perform 1 from public.profiles where id = current_owner for update;

  if p_call_id is not null then
    select execution.result into previous_result from public.tool_executions as execution
    where execution.owner_id = current_owner and execution.call_id = p_call_id and execution.tool_name = 'control_focus_timer';
    if found and previous_result is not null then return previous_result; end if;
  end if;

  update public.focus_sessions
  set status = 'completed', completed_at = target_ends_at, paused_at = null
  where owner_id = current_owner and status = 'active' and target_ends_at <= server_now
  returning * into session_row;

  if found then
    transition := 'completed';
  else
    select * into session_row from public.focus_sessions
    where owner_id = current_owner and status in ('active', 'paused')
    order by created_at desc limit 1 for update;

    if not found then
      result := jsonb_build_object('session', null, 'transition', 'no_open_session', 'persisted', true, 'server_now', server_now);
      return result;
    end if;

    if p_action = 'pause' and session_row.status = 'active' then
      update public.focus_sessions set status = 'paused', paused_at = server_now where id = session_row.id returning * into session_row;
      transition := 'paused';
    elsif p_action = 'pause' then
      transition := 'already_paused';
    elsif p_action = 'resume' and session_row.status = 'paused' then
      pause_seconds := greatest(0, floor(extract(epoch from (server_now - session_row.paused_at)))::integer);
      update public.focus_sessions
      set status = 'active', target_ends_at = target_ends_at + (server_now - paused_at),
          accumulated_pause_seconds = accumulated_pause_seconds + pause_seconds, paused_at = null
      where id = session_row.id returning * into session_row;
      transition := 'resumed';
    elsif p_action = 'resume' then
      transition := 'already_active';
    elsif p_action = 'stop' then
      pause_seconds := case when session_row.status = 'paused' then greatest(0, floor(extract(epoch from (server_now - session_row.paused_at)))::integer) else 0 end;
      update public.focus_sessions
      set status = 'cancelled',
          target_ends_at = target_ends_at + case when paused_at is not null then (server_now - paused_at) else interval '0 seconds' end,
          accumulated_pause_seconds = accumulated_pause_seconds + pause_seconds, paused_at = null, completed_at = null
      where id = session_row.id returning * into session_row;
      transition := 'cancelled';
    else
      transition := 'not_due';
    end if;
  end if;

  result := jsonb_build_object('session', to_jsonb(session_row), 'transition', transition, 'persisted', true, 'server_now', server_now);
  if p_call_id is not null then
    insert into public.tool_executions (owner_id, call_id, tool_name, result)
    values (current_owner, p_call_id, 'control_focus_timer', result);
  end if;
  return result;
end;
$$;

create or replace function public.get_current_focus_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  server_now timestamptz := clock_timestamp();
  session_row public.focus_sessions%rowtype;
begin
  if current_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = current_owner for update;
  update public.focus_sessions set status = 'completed', completed_at = target_ends_at, paused_at = null
  where owner_id = current_owner and status = 'active' and target_ends_at <= server_now;
  select * into session_row from public.focus_sessions
  where owner_id = current_owner and status in ('active', 'paused') order by created_at desc limit 1;
  return jsonb_build_object('session', case when found then to_jsonb(session_row) else null end, 'persisted', true, 'server_now', server_now);
end;
$$;

revoke all on function public.start_focus_session(integer, text) from public, anon;
revoke all on function public.control_focus_timer(text, text) from public, anon;
revoke all on function public.get_current_focus_session() from public, anon;
grant execute on function public.start_focus_session(integer, text) to authenticated;
grant execute on function public.control_focus_timer(text, text) to authenticated;
grant execute on function public.get_current_focus_session() to authenticated;
