alter table public.research_sessions
  drop constraint if exists research_sessions_question_check;

alter table public.research_sessions
  add constraint research_sessions_question_check
  check (char_length(question) between 2 and 500);
