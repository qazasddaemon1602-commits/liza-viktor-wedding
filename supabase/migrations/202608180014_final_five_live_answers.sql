alter table public.quiz_state
  add column final_five_revealed_at timestamptz;

create table public.final_five_role_access (
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null check (role in ('liza', 'viktor')),
  token_hash text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (event_id, role)
);

create table public.final_five_answers (
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  role text not null check (role in ('liza', 'viktor')),
  choice text not null check (choice in ('liza', 'viktor')),
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, question_id, role)
);

create index final_five_answers_question_idx
  on public.final_five_answers(event_id, question_id);

alter table public.final_five_role_access enable row level security;
alter table public.final_five_answers enable row level security;

revoke all on table public.final_five_role_access from anon, authenticated;
revoke all on table public.final_five_answers from anon, authenticated;

create or replace function public._final_five_token_hash(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public._reset_final_five_reveal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_question_id is distinct from old.current_question_id
     or (new.phase = 'voting' and old.phase is distinct from 'voting') then
    new.final_five_revealed_at := null;
  end if;
  return new;
end;
$$;

create trigger quiz_state_reset_final_five_reveal
before update on public.quiz_state
for each row
execute function public._reset_final_five_reveal();

create or replace function public.owner_seed_final_five_questions(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer := 0;
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

  insert into public.questions(event_id, text, question_type, sort_order, enabled)
  values
    (p_event_id, 'Кто главный?', 'final_five', 101, true),
    (p_event_id, 'Кто первым мирится?', 'final_five', 102, true),
    (p_event_id, 'Кто транжира?', 'final_five', 103, true),
    (p_event_id, 'Кто заведёт ещё одно животное?', 'final_five', 104, true),
    (p_event_id, 'Кто кого больше избаловал?', 'final_five', 105, true)
  on conflict (event_id, sort_order) do update
  set text = excluded.text,
      question_type = 'final_five',
      enabled = true,
      updated_at = now();

  select count(*)::integer into v_count
  from public.questions q
  where q.event_id = p_event_id
    and q.question_type = 'final_five'
    and q.enabled;

  return jsonb_build_object('status', 'ready', 'questionCount', v_count);
end;
$$;

create or replace function public.owner_issue_final_five_role_access(
  p_event_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_token text;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;
  if p_role not in ('liza', 'viktor') then
    raise exception 'invalid final-five role' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.final_five_role_access(event_id, role, token_hash, issued_at, revoked_at)
  values (p_event_id, p_role, public._final_five_token_hash(v_token), now(), null)
  on conflict (event_id, role) do update
  set token_hash = excluded.token_hash,
      issued_at = now(),
      revoked_at = null;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'final_five_role_access_issued',
    jsonb_build_object('role', p_role)
  );

  return jsonb_build_object('status', 'issued', 'role', p_role, 'token', v_token);
end;
$$;

create or replace function public.get_final_five_role_state(
  p_event_slug text,
  p_role text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_question public.questions%rowtype;
  v_question_id uuid;
  v_phase text := 'idle';
  v_choice text;
begin
  if p_role not in ('liza', 'viktor') or length(coalesce(p_token, '')) < 16 then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (
    select 1
    from public.final_five_role_access a
    where a.event_id = v_event_id
      and a.role = p_role
      and a.revoked_at is null
      and a.token_hash = public._final_five_token_hash(p_token)
  ) then
    return jsonb_build_object('status', 'invalid_access');
  end if;

  select qs.current_question_id, qs.phase
  into v_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id;

  if v_question_id is null or v_phase = 'idle' then
    return jsonb_build_object('status', 'idle', 'role', p_role);
  end if;

  select q.* into v_question
  from public.questions q
  where q.id = v_question_id
    and q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'final_five';

  if v_question.id is null then
    return jsonb_build_object('status', 'idle', 'role', p_role);
  end if;

  select a.choice into v_choice
  from public.final_five_answers a
  where a.event_id = v_event_id
    and a.question_id = v_question_id
    and a.role = p_role;

  return jsonb_build_object(
    'status', 'active',
    'role', p_role,
    'phase', v_phase,
    'question', jsonb_build_object(
      'id', v_question.id,
      'text', v_question.text
    ),
    'selectedChoice', v_choice
  );
end;
$$;

create or replace function public.submit_final_five_answer(
  p_event_slug text,
  p_role text,
  p_token text,
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
  v_current_question_id uuid;
  v_phase text := 'idle';
begin
  if p_role not in ('liza', 'viktor') or p_choice not in ('liza', 'viktor') then
    raise exception 'invalid final-five answer' using errcode = '22023';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.final_five_role_access a
    where a.event_id = v_event_id
      and a.role = p_role
      and a.revoked_at is null
      and a.token_hash = public._final_five_token_hash(p_token)
  ) then
    raise exception 'invalid final-five access' using errcode = '42501';
  end if;

  select qs.current_question_id, qs.phase
  into v_current_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = v_event_id
  for update;

  if v_current_question_id is null
     or v_current_question_id <> p_question_id
     or v_phase <> 'voting' then
    raise exception 'final-five question is not accepting answers' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and q.event_id = v_event_id
      and q.enabled
      and q.question_type = 'final_five'
  ) then
    raise exception 'final-five question required' using errcode = '55000';
  end if;

  insert into public.final_five_answers(event_id, question_id, role, choice, answered_at, updated_at)
  values (v_event_id, p_question_id, p_role, p_choice, now(), now())
  on conflict (event_id, question_id, role) do update
  set choice = excluded.choice,
      updated_at = now();

  return jsonb_build_object(
    'status', 'accepted',
    'questionId', p_question_id,
    'role', p_role,
    'choice', p_choice
  );
end;
$$;

create or replace function public.owner_get_final_five_status(
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
  v_current_question_id uuid;
  v_phase text := 'idle';
  v_revealed_at timestamptz;
  v_answered_count integer := 0;
  v_liza_answered boolean := false;
  v_viktor_answered boolean := false;
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
  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and q.event_id = p_event_id
      and q.enabled
      and q.question_type = 'final_five'
  ) then
    return jsonb_build_object('status', 'not_ready');
  end if;

  select qs.current_question_id, qs.phase, qs.final_five_revealed_at
  into v_current_question_id, v_phase, v_revealed_at
  from public.quiz_state qs
  where qs.event_id = p_event_id;

  select count(*)::integer into v_answered_count
  from public.quiz_votes qv
  where qv.event_id = p_event_id and qv.question_id = p_question_id;

  select exists(
    select 1 from public.final_five_answers a
    where a.event_id = p_event_id and a.question_id = p_question_id and a.role = 'liza'
  ) into v_liza_answered;

  select exists(
    select 1 from public.final_five_answers a
    where a.event_id = p_event_id and a.question_id = p_question_id and a.role = 'viktor'
  ) into v_viktor_answered;

  return jsonb_build_object(
    'status', 'ok',
    'current', v_current_question_id = p_question_id,
    'phase', case when v_current_question_id = p_question_id then v_phase else 'idle' end,
    'answeredCount', v_answered_count,
    'lizaAnswered', v_liza_answered,
    'viktorAnswered', v_viktor_answered,
    'revealed', v_revealed_at is not null and v_current_question_id = p_question_id
  );
end;
$$;

create or replace function public.owner_reveal_final_five(
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
  v_current_question_id uuid;
  v_phase text := 'idle';
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

  select qs.current_question_id, qs.phase
  into v_current_question_id, v_phase
  from public.quiz_state qs
  where qs.event_id = p_event_id
  for update;

  if v_current_question_id is distinct from p_question_id or v_phase <> 'results' then
    raise exception 'guest results must be revealed first' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and q.event_id = p_event_id
      and q.enabled
      and q.question_type = 'final_five'
  ) then
    raise exception 'final-five question required' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.final_five_answers a
    where a.event_id = p_event_id and a.question_id = p_question_id and a.role = 'liza'
  ) or not exists (
    select 1 from public.final_five_answers a
    where a.event_id = p_event_id and a.question_id = p_question_id and a.role = 'viktor'
  ) then
    raise exception 'both live answers are required' using errcode = '55000';
  end if;

  update public.quiz_state
  set final_five_revealed_at = coalesce(final_five_revealed_at, now()),
      updated_at = now()
  where event_id = p_event_id
    and current_question_id = p_question_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'final_five_revealed',
    jsonb_build_object('questionId', p_question_id)
  );

  return jsonb_build_object('status', 'revealed', 'questionId', p_question_id);
end;
$$;

create or replace function public.get_revealed_final_five(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_question public.questions%rowtype;
  v_question_id uuid;
  v_phase text := 'idle';
  v_revealed_at timestamptz;
  v_liza_answer text;
  v_viktor_answer text;
  v_liza_votes integer := 0;
  v_viktor_votes integer := 0;
  v_total integer := 0;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select qs.current_question_id, qs.phase, qs.final_five_revealed_at
  into v_question_id, v_phase, v_revealed_at
  from public.quiz_state qs
  where qs.event_id = v_event_id;

  if v_question_id is null or v_phase <> 'results' or v_revealed_at is null then
    return jsonb_build_object('status', 'hidden');
  end if;

  select q.* into v_question
  from public.questions q
  where q.id = v_question_id
    and q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'final_five';

  if v_question.id is null then
    return jsonb_build_object('status', 'hidden');
  end if;

  select a.choice into v_liza_answer
  from public.final_five_answers a
  where a.event_id = v_event_id and a.question_id = v_question_id and a.role = 'liza';
  select a.choice into v_viktor_answer
  from public.final_five_answers a
  where a.event_id = v_event_id and a.question_id = v_question_id and a.role = 'viktor';

  if v_liza_answer is null or v_viktor_answer is null then
    return jsonb_build_object('status', 'hidden');
  end if;

  select
    count(*) filter (where qv.choice = 'liza')::integer,
    count(*) filter (where qv.choice = 'viktor')::integer,
    count(*)::integer
  into v_liza_votes, v_viktor_votes, v_total
  from public.quiz_votes qv
  where qv.event_id = v_event_id and qv.question_id = v_question_id;

  return jsonb_build_object(
    'status', 'revealed',
    'question', jsonb_build_object('id', v_question.id, 'text', v_question.text),
    'results', jsonb_build_object('liza', v_liza_votes, 'viktor', v_viktor_votes, 'total', v_total),
    'lizaAnswer', v_liza_answer,
    'viktorAnswer', v_viktor_answer
  );
end;
$$;

revoke all on function public._final_five_token_hash(text) from public, anon, authenticated;
revoke all on function public._reset_final_five_reveal() from public, anon, authenticated;
revoke all on function public.owner_seed_final_five_questions(uuid) from public, anon;
revoke all on function public.owner_issue_final_five_role_access(uuid, text) from public, anon;
revoke all on function public.get_final_five_role_state(text, text, text) from public;
revoke all on function public.submit_final_five_answer(text, text, text, uuid, text) from public;
revoke all on function public.owner_get_final_five_status(uuid, uuid) from public, anon;
revoke all on function public.owner_reveal_final_five(uuid, uuid) from public, anon;
revoke all on function public.get_revealed_final_five(text) from public;

grant execute on function public.owner_seed_final_five_questions(uuid) to authenticated;
grant execute on function public.owner_issue_final_five_role_access(uuid, text) to authenticated;
grant execute on function public.get_final_five_role_state(text, text, text) to anon, authenticated;
grant execute on function public.submit_final_five_answer(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.owner_get_final_five_status(uuid, uuid) to authenticated;
grant execute on function public.owner_reveal_final_five(uuid, uuid) to authenticated;
grant execute on function public.get_revealed_final_five(text) to anon, authenticated;
