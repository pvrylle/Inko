drop policy if exists quizzes_insert_own on public.quizzes;
drop policy if exists quizzes_update_own on public.quizzes;
drop policy if exists quizzes_delete_own on public.quizzes;
drop policy if exists quiz_questions_insert_own on public.quiz_questions;
drop policy if exists quiz_questions_update_own on public.quiz_questions;
drop policy if exists quiz_questions_delete_own on public.quiz_questions;
drop policy if exists quiz_attempts_insert_own on public.quiz_attempts;
drop policy if exists quiz_attempts_update_own on public.quiz_attempts;
drop policy if exists quiz_attempts_delete_own on public.quiz_attempts;

revoke insert, update, delete on public.quizzes from authenticated;
revoke insert, update, delete on public.quiz_questions from authenticated;
revoke insert, update, delete on public.quiz_attempts from authenticated;

create or replace function public.create_quiz_from_generated(
  p_owner_id uuid,
  p_note_id uuid,
  p_title text,
  p_questions jsonb,
  p_call_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_result jsonb;
  quiz_row public.quizzes%rowtype;
  question_row public.quiz_questions%rowtype;
  question_item jsonb;
  public_questions jsonb := '[]'::jsonb;
  option_values text[];
  correct_index integer;
  question_position integer := 0;
  result jsonb;
begin
  select execution.result into previous_result
  from public.tool_executions as execution
  where owner_id = p_owner_id and call_id = p_call_id and tool_name = 'start_quiz';
  if found and previous_result is not null then return previous_result; end if;

  if not exists (select 1 from public.notes where id = p_note_id and owner_id = p_owner_id) then
    raise exception 'NOTE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if char_length(trim(p_title)) not between 1 and 160 then raise exception 'INVALID_QUIZ_TITLE'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 4 and 8 then raise exception 'INVALID_QUIZ_QUESTIONS'; end if;

  insert into public.quizzes (owner_id, note_id, title)
  values (p_owner_id, p_note_id, trim(p_title))
  returning * into quiz_row;

  for question_item in select value from jsonb_array_elements(p_questions)
  loop
    select array_agg(value order by ordinal) into option_values
    from jsonb_array_elements_text(question_item->'options') with ordinality as options(value, ordinal);
    correct_index := (question_item->>'correct_index')::integer;
    if cardinality(option_values) <> 4 or correct_index not between 0 and 3 then raise exception 'INVALID_QUIZ_QUESTION'; end if;

    insert into public.quiz_questions (owner_id, quiz_id, position, prompt, options)
    values (p_owner_id, quiz_row.id, question_position, trim(question_item->>'prompt'), option_values)
    returning * into question_row;

    insert into private.quiz_answer_keys (question_id, owner_id, correct_index, explanation)
    values (question_row.id, p_owner_id, correct_index, trim(question_item->>'explanation'));

    public_questions := public_questions || jsonb_build_array(to_jsonb(question_row));
    question_position := question_position + 1;
  end loop;

  result := jsonb_build_object('quiz', to_jsonb(quiz_row), 'questions', public_questions, 'persisted', true);
  insert into public.tool_executions (owner_id, call_id, tool_name, result)
  values (p_owner_id, p_call_id, 'start_quiz', result);
  return result;
end;
$$;

create or replace function public.submit_quiz_answer(p_question_id uuid, p_selected_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  question_row public.quiz_questions%rowtype;
  answer_row private.quiz_answer_keys%rowtype;
  attempt_row public.quiz_attempts%rowtype;
begin
  if current_owner is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_selected_index not between 0 and 3 then raise exception 'INVALID_QUIZ_ANSWER'; end if;

  select question.* into question_row
  from public.quiz_questions as question
  join public.quizzes as quiz on quiz.id = question.quiz_id and quiz.owner_id = current_owner
  where question.id = p_question_id and question.owner_id = current_owner;
  if not found then raise exception 'QUIZ_QUESTION_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into answer_row from private.quiz_answer_keys
  where question_id = question_row.id and owner_id = current_owner;
  if not found then raise exception 'QUIZ_ANSWER_KEY_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into attempt_row from public.quiz_attempts
  where owner_id = current_owner and question_id = question_row.id;

  if not found then
    insert into public.quiz_attempts (owner_id, quiz_id, question_id, selected_index, correct, feedback)
    values (
      current_owner,
      question_row.quiz_id,
      question_row.id,
      p_selected_index,
      p_selected_index = answer_row.correct_index,
      case when p_selected_index = answer_row.correct_index then 'Correct. ' else 'Not quite. ' end || answer_row.explanation
    )
    on conflict (owner_id, question_id) do nothing
    returning * into attempt_row;

    if attempt_row.id is null then
      select * into attempt_row from public.quiz_attempts
      where owner_id = current_owner and question_id = question_row.id;
    end if;
  end if;

  return jsonb_build_object('attempt', to_jsonb(attempt_row), 'correct_index', answer_row.correct_index, 'persisted', true);
end;
$$;

revoke all on function public.create_quiz_from_generated(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_quiz_from_generated(uuid, uuid, text, jsonb, text) to service_role;
revoke all on function public.submit_quiz_answer(uuid, integer) from public, anon;
grant execute on function public.submit_quiz_answer(uuid, integer) to authenticated;
