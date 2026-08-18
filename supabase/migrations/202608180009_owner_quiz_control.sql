create or replace function public.owner_seed_default_quiz_questions(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_inserted_count integer := 0;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.questions q
    where q.event_id = p_event_id
  ) then
    insert into public.quiz_state(event_id, phase, updated_at)
    values (p_event_id, 'idle', now())
    on conflict (event_id) do nothing;

    return jsonb_build_object(
      'status', 'existing',
      'insertedCount', 0
    );
  end if;

  insert into public.questions(event_id, text, question_type, sort_order, enabled)
  values
    (p_event_id, 'Кто дольше собирается?', 'standard', 1, true),
    (p_event_id, 'Кто первым мирится после ссоры?', 'standard', 2, true),
    (p_event_id, 'Кто чаще говорит «Я же говорил»?', 'standard', 3, true),
    (p_event_id, 'Кто скорее заведёт ещё одного питомца?', 'standard', 4, true),
    (p_event_id, 'Кто переживёт зомби-апокалипсис?', 'standard', 5, true),
    (p_event_id, 'Кто чаще делает спонтанные покупки?', 'standard', 6, true),
    (p_event_id, 'Кто в доме главный?', 'standard', 7, true),
    (p_event_id, 'Кто быстрее уснёт во время фильма?', 'standard', 8, true),
    (p_event_id, 'Кто лучше готовит?', 'standard', 9, true),
    (p_event_id, 'Кто скорее предложит заказать доставку?', 'standard', 10, true),
    (p_event_id, 'Кто транжира?', 'standard', 11, true),
    (p_event_id, 'Кто кого больше избаловал?', 'standard', 12, true),
    (p_event_id, 'Кто чаще теряет телефон?', 'standard', 13, true),
    (p_event_id, 'Кто может пойти за хлебом и вернуться со всем, кроме хлеба?', 'standard', 14, true),
    (p_event_id, 'Кто прочитает инструкцию до сборки мебели?', 'standard', 15, true),
    (p_event_id, 'Кто первым замечает бардак?', 'standard', 16, true),
    (p_event_id, 'Кто быстрее заснёт после «я вообще не хочу спать»?', 'standard', 17, true),
    (p_event_id, 'Кто сильнее бесится, когда второй опаздывает?', 'standard', 18, true),
    (p_event_id, 'Кто чаще проверяет, закрыта ли дверь?', 'standard', 19, true),
    (p_event_id, 'Кто выбирает маршрут в навигаторе?', 'standard', 20, true),
    (p_event_id, 'Кто больше фотографирует в отпуске?', 'standard', 21, true),
    (p_event_id, 'Кто проживёт неделю без телефона?', 'standard', 22, true),
    (p_event_id, 'Кто полезет чинить дома сам?', 'standard', 23, true),
    (p_event_id, 'Кто лучше пройдёт детектор лжи?', 'standard', 24, true),
    (p_event_id, 'Кто первым смеётся в неподходящий момент?', 'standard', 25, true),
    (p_event_id, 'Кто более азартный?', 'standard', 26, true),
    (p_event_id, 'Кто добровольно берёт микрофон в караоке?', 'standard', 27, true),
    (p_event_id, 'Кто первым говорит «пора домой»?', 'standard', 28, true),
    (p_event_id, 'Кто лучше помнит даты?', 'standard', 29, true),
    (p_event_id, 'Кто смотрит сериал без второго и делает вид, что нет?', 'standard', 30, true);

  get diagnostics v_inserted_count = row_count;

  insert into public.quiz_state(event_id, phase, updated_at)
  values (p_event_id, 'idle', now())
  on conflict (event_id) do nothing;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_default_questions_seeded',
    jsonb_build_object('insertedCount', v_inserted_count)
  );

  return jsonb_build_object(
    'status', 'seeded',
    'insertedCount', v_inserted_count
  );
end;
$$;

create or replace function public.owner_get_quiz_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_phase text := 'idle';
  v_current_question_id uuid;
  v_questions jsonb := '[]'::jsonb;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_total integer := 0;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  select qs.phase, qs.current_question_id
  into v_phase, v_current_question_id
  from public.quiz_state qs
  where qs.event_id = p_event_id;

  v_phase := coalesce(v_phase, 'idle');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'text', q.text,
        'questionType', q.question_type,
        'sortOrder', q.sort_order,
        'enabled', q.enabled,
        'imagePath', q.image_path
      ) order by q.sort_order
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.questions q
  where q.event_id = p_event_id;

  if v_current_question_id is not null then
    select count(*)::integer
    into v_answered_count
    from public.quiz_votes qv
    where qv.event_id = p_event_id
      and qv.question_id = v_current_question_id;
  end if;

  v_result := jsonb_build_object(
    'status', 'ok',
    'phase', v_phase,
    'currentQuestionId', v_current_question_id,
    'answeredCount', v_answered_count,
    'questions', v_questions
  );

  if v_phase = 'results' and v_current_question_id is not null then
    select
      count(*) filter (where qv.choice = 'liza')::integer,
      count(*) filter (where qv.choice = 'viktor')::integer,
      count(*)::integer
    into v_liza_votes, v_viktor_votes, v_total
    from public.quiz_votes qv
    where qv.event_id = p_event_id
      and qv.question_id = v_current_question_id;

    v_result := v_result || jsonb_build_object(
      'results', jsonb_build_object(
        'liza', v_liza_votes,
        'viktor', v_viktor_votes,
        'total', v_total
      )
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.owner_seed_default_quiz_questions(uuid) from public, anon;
revoke all on function public.owner_get_quiz_control(uuid) from public, anon;

grant execute on function public.owner_seed_default_quiz_questions(uuid) to authenticated;
grant execute on function public.owner_get_quiz_control(uuid) to authenticated;
