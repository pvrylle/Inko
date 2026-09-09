create or replace function public.commit_flashcard_review(
  p_card_id uuid,
  p_review_id uuid,
  p_rating public.study_rating,
  p_answer_text text,
  p_semantic_score real,
  p_feedback text,
  p_due timestamptz,
  p_stability real,
  p_difficulty real,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_state integer,
  p_last_review timestamptz,
  p_reviewed_at timestamptz
)
returns setof public.flashcards
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_card public.flashcards%rowtype;
begin
  select * into current_card
  from public.flashcards
  where id = p_card_id and owner_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'FLASHCARD_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.flashcards
  set due = p_due,
      stability = p_stability,
      difficulty = p_difficulty,
      elapsed_days = p_elapsed_days,
      scheduled_days = p_scheduled_days,
      learning_steps = p_learning_steps,
      reps = p_reps,
      lapses = p_lapses,
      state = p_state,
      last_review = p_last_review,
      updated_at = p_reviewed_at
  where id = p_card_id and owner_id = (select auth.uid());

  insert into public.flashcard_reviews (
    id, owner_id, flashcard_id, rating, answer_text, semantic_score,
    feedback, previous_due, next_due, reviewed_at
  ) values (
    p_review_id, (select auth.uid()), p_card_id, p_rating, p_answer_text,
    p_semantic_score, p_feedback, current_card.due, p_due, p_reviewed_at
  );

  return query
  select * from public.flashcards
  where id = p_card_id and owner_id = (select auth.uid());
end;
$$;

revoke all on function public.commit_flashcard_review(uuid, uuid, public.study_rating, text, real, text, timestamptz, real, real, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.commit_flashcard_review(uuid, uuid, public.study_rating, text, real, text, timestamptz, real, real, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz) to authenticated;
