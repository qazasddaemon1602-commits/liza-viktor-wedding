create table public.questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  question_type text not null default 'standard' check (question_type in ('standard', 'final_five')),
  sort_order integer not null check (sort_order > 0),
  enabled boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, sort_order)
);

create table public.quiz_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  current_question_id uuid references public.questions(id) on delete set null,
  phase text not null default 'idle' check (phase in ('idle', 'voting', 'results')),
  activated_at timestamptz,
  revealed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.quiz_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  choice text not null check (choice in ('liza', 'viktor')),
  created_at timestamptz not null default now(),
  unique (question_id, guest_id)
);

create index questions_event_enabled_idx
  on public.questions(event_id, enabled, sort_order);
create index quiz_votes_question_choice_idx
  on public.quiz_votes(question_id, choice);
create index quiz_votes_event_guest_idx
  on public.quiz_votes(event_id, guest_id);

alter table public.questions enable row level security;
alter table public.quiz_state enable row level security;
alter table public.quiz_votes enable row level security;

revoke all on table public.questions from anon, authenticated;
revoke all on table public.quiz_state from anon, authenticated;
revoke all on table public.quiz_votes from anon, authenticated;

grant select, insert, update, delete on table public.questions to authenticated;
grant select on table public.quiz_state to authenticated;
grant select on table public.quiz_votes to authenticated;

create policy "owner manages own quiz questions"
on public.questions
for all
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = questions.event_id and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = questions.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads own quiz state"
on public.quiz_state
for select
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = quiz_state.event_id and e.owner_user_id = auth.uid()
  )
);

create policy "owner reads own quiz votes"
on public.quiz_votes
for select
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = quiz_votes.event_id and e.owner_user_id = auth.uid()
  )
);

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
  v_question public.questions%rowtype;
  v_phase text;
  v_choice text;
  v_answered_count integer := 0;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
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

  select qs.phase, q.*
  into v_phase, v_question
  from public.quiz_state qs
  join public.questions q on q.id = qs.current_question_id
  where qs.event_id = v_event_id
    and q.event_id = v_event_id
    and q.enabled;

  if v_question.id is null or v_phase = 'idle' then
    return jsonb_build_object('status', 'idle');
  end if;

  select qv.choice into v_choice
  from public.quiz_votes qv
  where qv.question_id = v_question.id
    and qv.guest_id = v_guest_id;

  select
    count(*)::integer,
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer
  into v_answered_count, v_liza_votes, v_viktor_votes
  from public.quiz_votes qv
  where qv.question_id = v_question.id;

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
      'selectedChoice', v_choice,
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
    'selectedChoice', v_choice,
    'answeredCount', v_answered_count
  );
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
begin
  if p_choice not in ('liza', 'viktor') then
    raise exception 'invalid quiz choice' using errcode = '22023';
  end if;

  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select gdb.guest_id into v_guest_id
  from public.guest_device_bindings gdb
  where gdb.event_id = v_event_id
    and gdb.device_key_hash = public._device_hash(p_device_key);

  if v_guest_id is null then
    raise exception 'registered guest required' using errcode = '42501';
  end if;

  select qs.current_question_id, qs.phase
  into v_current_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id
  for update;

  if v_current_question_id is null
     or v_current_question_id <> p_question_id
     or v_phase <> 'voting' then
    raise exception 'question is not accepting votes' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and q.event_id = v_event_id
      and q.enabled
  ) then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  select qv.choice into v_existing_choice
  from public.quiz_votes qv
  where qv.question_id = p_question_id
    and qv.guest_id = v_guest_id;

  if v_existing_choice is not null then
    return jsonb_build_object(
      'status', 'already_voted',
      'choice', v_existing_choice
    );
  end if;

  insert into public.quiz_votes(event_id, question_id, guest_id, choice)
  values (v_event_id, p_question_id, v_guest_id, p_choice);

  update public.guests
  set last_seen_at = now()
  where id = v_guest_id;

  return jsonb_build_object(
    'status', 'accepted',
    'choice', p_choice
  );
end;
$$;

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
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    join public.questions q on q.event_id = e.id
    where e.id = p_event_id
      and e.owner_user_id = v_owner
      and q.id = p_question_id
      and q.enabled
  ) then
    raise exception 'owner access required or question not found' using errcode = '42501';
  end if;

  insert into public.quiz_state(
    event_id,
    current_question_id,
    phase,
    activated_at,
    revealed_at,
    updated_at
  )
  values (
    p_event_id,
    p_question_id,
    'voting',
    now(),
    null,
    now()
  )
  on conflict (event_id) do update
  set current_question_id = excluded.current_question_id,
      phase = 'voting',
      activated_at = now(),
      revealed_at = null,
      updated_at = now();

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_question_activated',
    jsonb_build_object('questionId', p_question_id)
  );

  return jsonb_build_object(
    'status', 'active',
    'questionId', p_question_id,
    'phase', 'voting'
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
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_total integer := 0;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    join public.quiz_state qs on qs.event_id = e.id
    where e.id = p_event_id
      and e.owner_user_id = v_owner
      and qs.current_question_id = p_question_id
      and qs.phase in ('voting', 'results')
  ) then
    raise exception 'owner access required or question is not active' using errcode = '42501';
  end if;

  update public.quiz_state
  set phase = 'results',
      revealed_at = coalesce(revealed_at, now()),
      updated_at = now()
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
      'liza', v_liza_votes,
      'viktor', v_viktor_votes,
      'total', v_total
    )
  );

  return jsonb_build_object(
    'status', 'revealed',
    'questionId', p_question_id,
    'results', jsonb_build_object(
      'liza', v_liza_votes,
      'viktor', v_viktor_votes,
      'total', v_total
    )
  );
end;
$$;

revoke all on function public.get_quiz_state(text, text) from public;
revoke all on function public.submit_quiz_vote(text, text, uuid, text) from public;
revoke all on function public.owner_activate_quiz_question(uuid, uuid) from public, anon;
revoke all on function public.owner_reveal_quiz_results(uuid, uuid) from public, anon;

grant execute on function public.get_quiz_state(text, text) to anon, authenticated;
grant execute on function public.submit_quiz_vote(text, text, uuid, text) to anon, authenticated;
grant execute on function public.owner_activate_quiz_question(uuid, uuid) to authenticated;
grant execute on function public.owner_reveal_quiz_results(uuid, uuid) to authenticated;
