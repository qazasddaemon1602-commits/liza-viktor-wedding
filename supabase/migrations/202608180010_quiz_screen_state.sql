create or replace function public.get_quiz_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_question_id uuid;
  v_question public.questions%rowtype;
  v_phase text;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select qs.current_question_id, qs.phase
  into v_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id;

  if v_question_id is null or coalesce(v_phase, 'idle') = 'idle' then
    return jsonb_build_object('status', 'idle');
  end if;

  select q.* into v_question
  from public.questions q
  where q.id = v_question_id
    and q.event_id = v_event_id
    and q.enabled;

  if v_question.id is null then
    return jsonb_build_object('status', 'idle');
  end if;

  select
    count(*)::integer,
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer
  into v_answered_count, v_liza_votes, v_viktor_votes
  from public.quiz_votes qv
  where qv.event_id = v_event_id
    and qv.question_id = v_question.id;

  if v_phase = 'results' then
    return jsonb_build_object(
      'status', 'active',
      'phase', 'results',
      'question', jsonb_build_object(
        'id', v_question.id,
        'text', v_question.text,
        'questionType', v_question.question_type,
        'imagePath', v_question.image_path
      ),
      'answeredCount', v_answered_count,
      'results', jsonb_build_object(
        'liza', v_liza_votes,
        'viktor', v_viktor_votes,
        'total', v_answered_count
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'active',
    'phase', 'voting',
    'question', jsonb_build_object(
      'id', v_question.id,
      'text', v_question.text,
      'questionType', v_question.question_type,
      'imagePath', v_question.image_path
    ),
    'answeredCount', v_answered_count
  );
end;
$$;

revoke all on function public.get_quiz_screen_state(text) from public;
grant execute on function public.get_quiz_screen_state(text) to anon, authenticated;
