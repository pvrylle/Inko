begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

select policies_are('public', 'notes', array[
  'notes_delete_own', 'notes_insert_own', 'notes_select_own', 'notes_update_own'
]);
select policies_are('public', 'flashcards', array[
  'flashcards_delete_own', 'flashcards_insert_own', 'flashcards_select_own', 'flashcards_update_own'
]);
select policies_are('public', 'quizzes', array['quizzes_select_own']);
select policies_are('public', 'quiz_questions', array['quiz_questions_select_own']);
select policies_are('public', 'quiz_attempts', array['quiz_attempts_select_own']);
select policies_are('public', 'focus_sessions', array['focus_sessions_select_own']);

select is((select relrowsecurity from pg_class where oid = 'public.notes'::regclass), true, 'notes has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.flashcards'::regclass), true, 'flashcards has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.quiz_attempts'::regclass), true, 'quiz attempts has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.chat_turns'::regclass), true, 'chat turns has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.focus_sessions'::regclass), true, 'focus sessions has RLS enabled');

select has_index('public', 'notes', 'notes_owner_created_idx', 'notes owner query is indexed');
select has_index('public', 'flashcards', 'flashcards_owner_due_idx', 'due-card query is indexed');
select has_index('public', 'chat_turns', 'chat_turns_owner_created_idx', 'chat history query is indexed');
select has_index('public', 'focus_sessions', 'focus_sessions_one_open_per_owner_idx', 'open focus sessions are uniquely indexed');
select has_index('public', 'voice_sessions', 'voice_sessions_pending_retry_idx', 'pending provider cleanup is indexed');
select has_index('public', 'voice_sessions', 'voice_sessions_stale_active_idx', 'stale active voice recovery is indexed');

select is(has_table_privilege('authenticated', 'public.quizzes', 'INSERT'), false, 'clients cannot insert quizzes');
select is(has_table_privilege('authenticated', 'public.quiz_questions', 'INSERT'), false, 'clients cannot insert quiz questions');
select is(has_table_privilege('authenticated', 'public.quiz_attempts', 'INSERT'), false, 'clients cannot forge quiz attempts');
select is(has_table_privilege('authenticated', 'public.quiz_attempts', 'UPDATE'), false, 'clients cannot alter quiz attempts');
select is(has_table_privilege('authenticated', 'public.quiz_attempts', 'DELETE'), false, 'clients cannot retry by deleting attempts');
select is(has_table_privilege('authenticated', 'private.quiz_answer_keys', 'SELECT'), false, 'clients cannot read private answer keys');
select is(has_function_privilege('authenticated', 'public.submit_quiz_answer(uuid,integer)', 'EXECUTE'), true, 'authenticated students can submit answers through the secure RPC');
select is(has_function_privilege('authenticated', 'public.create_quiz_from_generated(uuid,uuid,text,jsonb,text)', 'EXECUTE'), false, 'clients cannot invoke generated quiz creation');
select is(has_function_privilege('service_role', 'public.create_quiz_from_generated(uuid,uuid,text,jsonb,text)', 'EXECUTE'), true, 'service role can atomically create generated quizzes');
select is(has_table_privilege('authenticated', 'public.focus_sessions', 'INSERT'), false, 'clients cannot create focus sessions directly');
select is(has_table_privilege('authenticated', 'public.focus_sessions', 'UPDATE'), false, 'clients cannot forge focus transitions');
select is(has_table_privilege('authenticated', 'public.focus_sessions', 'DELETE'), false, 'clients cannot erase focus history');
select is(has_function_privilege('authenticated', 'public.start_focus_session(integer,text)', 'EXECUTE'), true, 'authenticated students can start focus through the RPC');
select is(has_function_privilege('authenticated', 'public.control_focus_timer(text,text)', 'EXECUTE'), true, 'authenticated students can control focus through the RPC');
select is(has_function_privilege('authenticated', 'public.get_current_focus_session()', 'EXECUTE'), true, 'authenticated students can reconcile focus through the RPC');

select policies_are('public', 'research_sessions', array[
  'research_sessions_delete_own', 'research_sessions_insert_own', 'research_sessions_select_own', 'research_sessions_update_own'
]);
select policies_are('public', 'library_files', array[
  'library_files_delete_own', 'library_files_insert_own', 'library_files_select_own', 'library_files_update_own'
]);
select policies_are('public', 'research_findings', array['research_findings_select_own']);
select is((select relrowsecurity from pg_class where oid = 'public.research_sessions'::regclass), true, 'research sessions has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.library_files'::regclass), true, 'library files has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.research_findings'::regclass), true, 'research findings has RLS enabled');
select has_index('public', 'research_sessions', 'research_sessions_owner_updated_idx', 'research sessions are indexed by owner');
select has_index('public', 'library_files', 'library_files_owner_uploaded_idx', 'library files are indexed by owner');
select is(has_table_privilege('authenticated', 'public.research_findings', 'INSERT'), false, 'clients cannot insert findings');
select is(has_table_privilege('authenticated', 'public.research_notes', 'INSERT'), false, 'clients cannot insert research notes');
select is(has_table_privilege('authenticated', 'public.research_runs', 'INSERT'), false, 'clients cannot insert research runs');
select is(has_column_privilege('authenticated', 'public.research_sources', 'extracted_text', 'SELECT'), false, 'clients cannot read extracted source text');
select is(has_function_privilege('authenticated', 'public.begin_research_analysis(uuid,uuid,text,text)', 'EXECUTE'), false, 'clients cannot start analysis directly');
select is(has_function_privilege('service_role', 'public.begin_research_analysis(uuid,uuid,text,text)', 'EXECUTE'), true, 'service role can start analysis');

select * from finish();
rollback;
