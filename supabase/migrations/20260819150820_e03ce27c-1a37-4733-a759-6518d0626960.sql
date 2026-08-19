alter table public.quiz_state
  add column if not exists present_on_main_screen boolean not null default false;

create table if not exists public.quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  phase text not null check (phase in ('voting', 'results', 'closed')),
  timed boolean not null default true,
  voting_started_at timestamptz not null,
  voting_ends_at timestamptz,
  results_started_at timestamptz,
  results_ends_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists quiz_rounds_one_open_per_event
  on public.quiz_rounds(event_id)
  where closed_at is null;
create index if not exists quiz_rounds_event_closed_idx
  on public.quiz_rounds(event_id, closed_at desc, created_at desc);

alter table public.quiz_rounds enable row level security;
revoke all on table public.quiz_rounds from anon, authenticated;
grant select on table public.quiz_rounds to authenticated;
grant all on table public.quiz_rounds to service_role;

drop policy if exists "owner reads own quiz rounds" on public.quiz_rounds;
create policy "owner reads own quiz rounds"
on public.quiz_rounds
for select
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = quiz_rounds.event_id and e.owner_user_id = auth.uid()
  )
);

create or replace function public._normalize_current_quiz_round(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.quiz_rounds%rowtype;
begin
  select * into v_round
  from public.quiz_rounds qr
  where qr.event_id = p_event_id
    and qr.closed_at is null
  order by qr.created_at desc
  limit 1
  for update;

  if v_round.id is null then
    return null;
  end if;

  if v_round.timed
     and v_round.phase = 'voting'
     and v_round.voting_ends_at is not null
     and v_round.voting_ends_at <= now() then
    update public.quiz_rounds
    set phase = 'results',
        results_started_at = coalesce(results_started_at, now()),
        results_ends_at = coalesce(results_ends_at, now() + interval '30 seconds')
    where id = v_round.id;

    update public.quiz_state
    set phase = 'results',
        revealed_at = coalesce(revealed_at, now()),
        updated_at = now()
    where event_id = p_event_id
      and current_question_id = v_round.question_id;

    select * into v_round from public.quiz_rounds where id = v_round.id;
  end if;

  if v_round.timed
     and v_round.phase = 'results'
     and v_round.results_ends_at is not null
     and v_round.results_ends_at <= now() then
    update public.quiz_rounds
    set phase = 'closed',
        closed_at = coalesce(closed_at, now())
    where id = v_round.id;

    update public.quiz_state
    set current_question_id = null,
        phase = 'idle',
        present_on_main_screen = false,
        updated_at = now()
    where event_id = p_event_id
      and current_question_id = v_round.question_id;
  end if;

  return v_round.id;
end;
$$;

revoke all on function public._normalize_current_quiz_round(uuid) from public, anon, authenticated;

create or replace function public.owner_activate_quiz_question(
  p_event_id uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_question_type text;
  v_round_id uuid;
  v_started_at timestamptz := now();
  v_ends_at timestamptz;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select q.question_type into v_question_type
  from public.events e
  join public.questions q on q.event_id = e.id
  where e.id = p_event_id
    and e.owner_user_id = v_owner
    and q.id = p_question_id
    and q.enabled;

  if v_question_type is null then
    raise exception 'owner access required or question not found' using errcode = '42501';
  end if;

  update public.quiz_rounds
  set phase = 'closed', closed_at = coalesce(closed_at, now())
  where event_id = p_event_id and closed_at is null;

  if v_question_type = 'standard' then
    v_ends_at := v_started_at + interval '30 seconds';
  else
    v_ends_at := null;
  end if;

  insert into public.quiz_rounds(
    event_id, question_id, phase, timed,
    voting_started_at, voting_ends_at
  )
  values (
    p_event_id, p_question_id, 'voting', v_question_type = 'standard',
    v_started_at, v_ends_at
  )
  returning id into v_round_id;

  insert into public.quiz_state(
    event_id, current_question_id, phase, activated_at,
    revealed_at, updated_at, present_on_main_screen
  )
  values (
    p_event_id, p_question_id, 'voting', v_started_at,
    null, now(), true
  )
  on conflict (event_id) do update
  set current_question_id = excluded.current_question_id,
      phase = 'voting',
      activated_at = excluded.activated_at,
      revealed_at = null,
      updated_at = now(),
      present_on_main_screen = true;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_question_activated',
    jsonb_build_object('questionId', p_question_id, 'roundId', v_round_id)
  );

  return jsonb_build_object(
    'status', 'active',
    'questionId', p_question_id,
    'roundId', v_round_id,
    'phase', 'voting',
    'phaseStartedAt', v_started_at,
    'phaseEndsAt', v_ends_at
  );
end;
$$;

create or replace function public.owner_reveal_quiz_results(
  p_event_id uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_round public.quiz_rounds%rowtype;
  v_started_at timestamptz;
  v_ends_at timestamptz;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_total integer := 0;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  perform public._normalize_current_quiz_round(p_event_id);

  select * into v_round
  from public.quiz_rounds qr
  where qr.event_id = p_event_id
    and qr.question_id = p_question_id
    and qr.closed_at is null
  order by qr.created_at desc
  limit 1
  for update;

  if v_round.id is null or v_round.phase not in ('voting', 'results') then
    raise exception 'owner access required or question is not active' using errcode = '42501';
  end if;

  if v_round.phase = 'voting' then
    v_started_at := now();
    v_ends_at := case when v_round.timed then v_started_at + interval '30 seconds' else null end;
    update public.quiz_rounds
    set phase = 'results',
        results_started_at = v_started_at,
        results_ends_at = v_ends_at
    where id = v_round.id;
  else
    v_started_at := v_round.results_started_at;
    v_ends_at := v_round.results_ends_at;
  end if;

  update public.quiz_state
  set phase = 'results',
      revealed_at = coalesce(revealed_at, v_started_at, now()),
      updated_at = now(),
      present_on_main_screen = true
  where event_id = p_event_id
    and current_question_id = p_question_id;

  select
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer,
    count(*)::integer
  into v_liza_votes, v_viktor_votes, v_total
  from public.quiz_votes qv
  where qv.event_id = p_event_id
    and qv.question_id = p_question_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_results_revealed',
    jsonb_build_object(
      'questionId', p_question_id,
      'roundId', v_round.id,
      'liza', v_liza_votes,
      'viktor', v_viktor_votes,
      'total', v_total
    )
  );

  return jsonb_build_object(
    'status', 'revealed',
    'questionId', p_question_id,
    'roundId', v_round.id,
    'phase', 'results',
    'phaseStartedAt', v_started_at,
    'phaseEndsAt', v_ends_at,
    'results', jsonb_build_object(
      'liza', v_liza_votes,
      'viktor', v_viktor_votes,
      'total', v_total
    )
  );
end;
$$;

create or replace function public.owner_close_quiz_round(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_round_id uuid;
  v_question_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  select qr.id, qr.question_id into v_round_id, v_question_id
  from public.quiz_rounds qr
  where qr.event_id = p_event_id and qr.closed_at is null
  order by qr.created_at desc limit 1 for update;

  if v_round_id is not null then
    update public.quiz_rounds
    set phase = 'closed', closed_at = coalesce(closed_at, now())
    where id = v_round_id;
  end if;

  update public.quiz_state
  set current_question_id = null,
      phase = 'idle',
      present_on_main_screen = false,
      updated_at = now()
  where event_id = p_event_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_round_closed',
    jsonb_build_object('roundId', v_round_id, 'questionId', v_question_id)
  );

  return jsonb_build_object('status', 'closed', 'roundId', v_round_id, 'questionId', v_question_id);
end;
$$;

create or replace function public.owner_return_quiz_to_main_screen(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  update public.quiz_state
  set present_on_main_screen = false, updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('status', 'main_screen');
end;
$$;

create or replace function public.get_quiz_state(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_question_id uuid;
  v_question public.questions%rowtype;
  v_round public.quiz_rounds%rowtype;
  v_phase text;
  v_choice text;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_history jsonb := '[]'::jsonb;
  v_base jsonb;
begin
  if length(coalesce(p_device_key, '')) < 8 then
    return jsonb_build_object('status', 'not_registered');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select gdb.guest_id into v_guest_id
  from public.guest_device_bindings gdb
  where gdb.event_id = v_event_id
    and gdb.device_key_hash = public._device_hash(p_device_key);

  if v_guest_id is null then
    return jsonb_build_object('status', 'not_registered');
  end if;

  perform public._normalize_current_quiz_round(v_event_id);

  select coalesce(jsonb_agg(entry order by closed_at desc), '[]'::jsonb)
  into v_history
  from (
    select
      qr.closed_at,
      jsonb_build_object(
        'roundId', qr.id,
        'questionId', q.id,
        'questionText', q.text,
        'questionType', q.question_type,
        'closedAt', qr.closed_at,
        'answeredCount', count(qv.id)::integer,
        'results', jsonb_build_object(
          'liza', count(qv.id) filter (where qv.choice = 'liza')::integer,
          'viktor', count(qv.id) filter (where qv.choice = 'viktor')::integer,
          'total', count(qv.id)::integer
        ),
        'selectedChoice', max(case when qv.guest_id = v_guest_id then qv.choice end)
      ) as entry
    from public.quiz_rounds qr
    join public.questions q on q.id = qr.question_id
    left join public.quiz_votes qv on qv.event_id = qr.event_id and qv.question_id = qr.question_id
    where qr.event_id = v_event_id and qr.closed_at is not null
    group by qr.id, q.id
    order by qr.closed_at desc
    limit 12
  ) history_rows;

  select qs.current_question_id, qs.phase
  into v_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id;

  if v_question_id is null or coalesce(v_phase, 'idle') = 'idle' then
    return jsonb_build_object('status', 'idle', 'history', v_history);
  end if;

  select * into v_round
  from public.quiz_rounds qr
  where qr.event_id = v_event_id and qr.question_id = v_question_id and qr.closed_at is null
  order by qr.created_at desc limit 1;

  select q.* into v_question
  from public.questions q
  where q.id = v_question_id and q.event_id = v_event_id and q.enabled;

  if v_question.id is null or v_round.id is null then
    return jsonb_build_object('status', 'idle', 'history', v_history);
  end if;

  select qv.choice into v_choice
  from public.quiz_votes qv
  where qv.question_id = v_question.id and qv.guest_id = v_guest_id;

  select
    count(*)::integer,
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer
  into v_answered_count, v_liza_votes, v_viktor_votes
  from public.quiz_votes qv
  where qv.question_id = v_question.id;

  v_base := jsonb_build_object(
    'status', 'active',
    'phase', v_phase,
    'roundId', v_round.id,
    'phaseStartedAt', case when v_phase = 'voting' then v_round.voting_started_at else v_round.results_started_at end,
    'phaseEndsAt', case when v_phase = 'voting' then v_round.voting_ends_at else v_round.results_ends_at end,
    'question', jsonb_build_object(
      'id', v_question.id,
      'text', v_question.text,
      'questionType', v_question.question_type,
      'imagePath', v_question.image_path
    ),
    'selectedChoice', v_choice,
    'answeredCount', v_answered_count,
    'history', v_history
  );

  if v_phase = 'results' then
    return v_base || jsonb_build_object(
      'results', jsonb_build_object(
        'liza', v_liza_votes,
        'viktor', v_viktor_votes,
        'total', v_answered_count
      )
    );
  end if;

  return v_base;
end;
$$;

create or replace function public.submit_quiz_vote(
  p_event_slug text,
  p_device_key text,
  p_question_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_current_question_id uuid;
  v_phase text;
  v_existing_choice text;
  v_round public.quiz_rounds%rowtype;
begin
  if p_choice not in ('liza', 'viktor') then
    raise exception 'invalid quiz choice' using errcode = '22023';
  end if;
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select e.id into v_event_id from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select gdb.guest_id into v_guest_id
  from public.guest_device_bindings gdb
  where gdb.event_id = v_event_id and gdb.device_key_hash = public._device_hash(p_device_key);
  if v_guest_id is null then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  perform public._normalize_current_quiz_round(v_event_id);

  select qs.current_question_id, qs.phase
  into v_current_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id
  for update;

  select * into v_round
  from public.quiz_rounds qr
  where qr.event_id = v_event_id and qr.closed_at is null
  order by qr.created_at desc limit 1;

  if v_current_question_id is null
     or v_current_question_id <> p_question_id
     or v_phase <> 'voting'
     or v_round.id is null
     or (v_round.timed and v_round.voting_ends_at is not null and now() >= v_round.voting_ends_at) then
    raise exception 'QUIZ_VOTING_CLOSED' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id and q.event_id = v_event_id and q.enabled
  ) then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  select qv.choice into v_existing_choice
  from public.quiz_votes qv
  where qv.question_id = p_question_id and qv.guest_id = v_guest_id;

  if v_existing_choice is not null then
    return jsonb_build_object('status', 'already_voted', 'choice', v_existing_choice);
  end if;

  insert into public.quiz_votes(event_id, question_id, guest_id, choice)
  values (v_event_id, p_question_id, v_guest_id, p_choice);

  update public.guests set last_seen_at = now() where id = v_guest_id;

  return jsonb_build_object('status', 'accepted', 'choice', p_choice);
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
  v_present boolean := false;
  v_questions jsonb := '[]'::jsonb;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_total integer := 0;
  v_round public.quiz_rounds%rowtype;
  v_history jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.events e where e.id = p_event_id and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  perform public._normalize_current_quiz_round(p_event_id);

  select qs.phase, qs.current_question_id, qs.present_on_main_screen
  into v_phase, v_current_question_id, v_present
  from public.quiz_state qs where qs.event_id = p_event_id;
  v_phase := coalesce(v_phase, 'idle');
  v_present := coalesce(v_present, false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id, 'text', q.text, 'questionType', q.question_type,
      'sortOrder', q.sort_order, 'enabled', q.enabled, 'imagePath', q.image_path
    ) order by q.sort_order
  ), '[]'::jsonb)
  into v_questions
  from public.questions q where q.event_id = p_event_id;

  if v_current_question_id is not null then
    select count(*)::integer into v_answered_count
    from public.quiz_votes qv
    where qv.event_id = p_event_id and qv.question_id = v_current_question_id;

    select * into v_round
    from public.quiz_rounds qr
    where qr.event_id = p_event_id and qr.question_id = v_current_question_id and qr.closed_at is null
    order by qr.created_at desc limit 1;
  end if;

  select coalesce(jsonb_agg(entry order by closed_at desc), '[]'::jsonb)
  into v_history
  from (
    select qr.closed_at,
      jsonb_build_object(
        'roundId', qr.id,
        'questionId', q.id,
        'questionText', q.text,
        'questionType', q.question_type,
        'closedAt', qr.closed_at,
        'answeredCount', count(qv.id)::integer,
        'results', jsonb_build_object(
          'liza', count(qv.id) filter (where qv.choice = 'liza')::integer,
          'viktor', count(qv.id) filter (where qv.choice = 'viktor')::integer,
          'total', count(qv.id)::integer
        )
      ) as entry
    from public.quiz_rounds qr
    join public.questions q on q.id = qr.question_id
    left join public.quiz_votes qv on qv.event_id = qr.event_id and qv.question_id = qr.question_id
    where qr.event_id = p_event_id and qr.closed_at is not null
    group by qr.id, q.id
    order by qr.closed_at desc
    limit 30
  ) rows;

  v_result := jsonb_build_object(
    'status', 'ok',
    'phase', v_phase,
    'currentQuestionId', v_current_question_id,
    'answeredCount', v_answered_count,
    'questions', v_questions,
    'history', v_history,
    'presentOnMainScreen', v_present,
    'roundId', v_round.id,
    'phaseStartedAt', case when v_phase = 'voting' then v_round.voting_started_at when v_phase = 'results' then v_round.results_started_at else null end,
    'phaseEndsAt', case when v_phase = 'voting' then v_round.voting_ends_at when v_phase = 'results' then v_round.results_ends_at else null end
  );

  if v_phase = 'results' and v_current_question_id is not null then
    select
      count(*) filter (where qv.choice = 'liza')::integer,
      count(*) filter (where qv.choice = 'viktor')::integer,
      count(*)::integer
    into v_liza_votes, v_viktor_votes, v_total
    from public.quiz_votes qv
    where qv.event_id = p_event_id and qv.question_id = v_current_question_id;

    v_result := v_result || jsonb_build_object(
      'results', jsonb_build_object('liza', v_liza_votes, 'viktor', v_viktor_votes, 'total', v_total)
    );
  end if;

  return v_result;
end;
$$;

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
  v_round public.quiz_rounds%rowtype;
  v_phase text;
  v_present boolean := false;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_base jsonb;
begin
  select e.id into v_event_id from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('status', 'not_found'); end if;

  perform public._normalize_current_quiz_round(v_event_id);

  select qs.current_question_id, qs.phase, qs.present_on_main_screen
  into v_question_id, v_phase, v_present
  from public.quiz_state qs where qs.event_id = v_event_id;

  if v_question_id is null or coalesce(v_phase, 'idle') = 'idle' or not coalesce(v_present, false) then
    return jsonb_build_object('status', 'idle');
  end if;

  select * into v_round from public.quiz_rounds qr
  where qr.event_id = v_event_id and qr.question_id = v_question_id and qr.closed_at is null
  order by qr.created_at desc limit 1;

  select q.* into v_question from public.questions q
  where q.id = v_question_id and q.event_id = v_event_id and q.enabled;
  if v_question.id is null or v_round.id is null then return jsonb_build_object('status', 'idle'); end if;

  select count(*)::integer,
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer
  into v_answered_count, v_liza_votes, v_viktor_votes
  from public.quiz_votes qv
  where qv.event_id = v_event_id and qv.question_id = v_question.id;

  v_base := jsonb_build_object(
    'status', 'active',
    'phase', v_phase,
    'roundId', v_round.id,
    'phaseStartedAt', case when v_phase = 'voting' then v_round.voting_started_at else v_round.results_started_at end,
    'phaseEndsAt', case when v_phase = 'voting' then v_round.voting_ends_at else v_round.results_ends_at end,
    'question', jsonb_build_object(
      'id', v_question.id, 'text', v_question.text,
      'questionType', v_question.question_type, 'imagePath', v_question.image_path
    ),
    'answeredCount', v_answered_count
  );

  if v_phase = 'results' then
    return v_base || jsonb_build_object(
      'results', jsonb_build_object('liza', v_liza_votes, 'viktor', v_viktor_votes, 'total', v_answered_count)
    );
  end if;

  return v_base;
end;
$$;

revoke all on function public.owner_activate_quiz_question(uuid, uuid) from public, anon;
revoke all on function public.owner_reveal_quiz_results(uuid, uuid) from public, anon;
revoke all on function public.owner_close_quiz_round(uuid) from public, anon;
revoke all on function public.owner_return_quiz_to_main_screen(uuid) from public, anon;
revoke all on function public.get_quiz_state(text, text) from public;
revoke all on function public.submit_quiz_vote(text, text, uuid, text) from public;
revoke all on function public.owner_get_quiz_control(uuid) from public, anon;
revoke all on function public.get_quiz_screen_state(text) from public;

grant execute on function public.owner_activate_quiz_question(uuid, uuid) to authenticated;
grant execute on function public.owner_reveal_quiz_results(uuid, uuid) to authenticated;
grant execute on function public.owner_close_quiz_round(uuid) to authenticated;
grant execute on function public.owner_return_quiz_to_main_screen(uuid) to authenticated;
grant execute on function public.get_quiz_state(text, text) to anon, authenticated;
grant execute on function public.submit_quiz_vote(text, text, uuid, text) to anon, authenticated;
grant execute on function public.owner_get_quiz_control(uuid) to authenticated;
grant execute on function public.get_quiz_screen_state(text) to anon, authenticated;