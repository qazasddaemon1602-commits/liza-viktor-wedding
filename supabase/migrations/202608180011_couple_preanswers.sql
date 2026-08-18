create table public.couple_preanswer_access (
  event_id uuid primary key references public.events(id) on delete cascade,
  token_hash text not null,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.couple_preanswers (
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  choice text not null check (choice in ('liza', 'viktor')),
  updated_at timestamptz not null default now(),
  primary key (event_id, question_id)
);

alter table public.couple_preanswer_access enable row level security;
alter table public.couple_preanswers enable row level security;

revoke all on table public.couple_preanswer_access from anon, authenticated;
revoke all on table public.couple_preanswers from anon, authenticated;

create or replace function public._couple_preanswer_token_hash(p_token text)
returns text
language sql
immutable
strict
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function public._couple_preanswer_token_hash(text) from public;

create or replace function public.owner_issue_couple_preanswer_access(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_existing public.couple_preanswer_access%rowtype;
  v_token text;
begin
  select e.* into v_event
  from public.events e
  where e.id = p_event_id;

  if v_event.id is null or v_event.owner_user_id is distinct from auth.uid() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  select a.* into v_existing
  from public.couple_preanswer_access a
  where a.event_id = p_event_id;

  if v_existing.finalized_at is not null or v_existing.consumed_at is not null then
    raise exception 'Couple preanswers are already finalized' using errcode = '55000';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.couple_preanswer_access (
    event_id,
    token_hash,
    issued_at,
    consumed_at,
    finalized_at,
    updated_at
  )
  values (
    p_event_id,
    public._couple_preanswer_token_hash(v_token),
    now(),
    null,
    null,
    now()
  )
  on conflict (event_id) do update
  set token_hash = excluded.token_hash,
      issued_at = excluded.issued_at,
      consumed_at = null,
      finalized_at = null,
      updated_at = now();

  return jsonb_build_object(
    'status', 'issued',
    'token', v_token
  );
end;
$$;

create or replace function public.get_couple_preanswer_form(
  p_event_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_access public.couple_preanswer_access%rowtype;
  v_questions jsonb;
  v_total_count integer := 0;
  v_answered_count integer := 0;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select a.* into v_access
  from public.couple_preanswer_access a
  where a.event_id = v_event_id;

  if v_access.event_id is null
     or v_access.token_hash <> public._couple_preanswer_token_hash(p_token) then
    raise exception 'Invalid couple preanswer access' using errcode = '42501';
  end if;

  if v_access.consumed_at is not null or v_access.finalized_at is not null then
    return jsonb_build_object('status', 'finished');
  end if;

  select count(*)::integer into v_total_count
  from public.questions q
  where q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  select count(*)::integer into v_answered_count
  from public.couple_preanswers a
  join public.questions q on q.id = a.question_id
  where a.event_id = v_event_id
    and q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'sortOrder', q.sort_order,
      'imagePath', q.image_path,
      'choice', a.choice
    ) order by q.sort_order, q.id
  ), '[]'::jsonb)
  into v_questions
  from public.questions q
  left join public.couple_preanswers a
    on a.event_id = v_event_id
   and a.question_id = q.id
  where q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  return jsonb_build_object(
    'status', 'active',
    'eventId', v_event_id,
    'questions', v_questions,
    'answeredCount', v_answered_count,
    'totalCount', v_total_count
  );
end;
$$;

create or replace function public.save_couple_preanswer(
  p_event_slug text,
  p_token text,
  p_question_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_access public.couple_preanswer_access%rowtype;
  v_question public.questions%rowtype;
begin
  if p_choice not in ('liza', 'viktor') then
    raise exception 'Invalid couple preanswer choice' using errcode = '22023';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select a.* into v_access
  from public.couple_preanswer_access a
  where a.event_id = v_event_id;

  if v_access.event_id is null
     or v_access.token_hash <> public._couple_preanswer_token_hash(p_token) then
    raise exception 'Invalid couple preanswer access' using errcode = '42501';
  end if;

  if v_access.consumed_at is not null or v_access.finalized_at is not null then
    raise exception 'Couple preanswers are finalized' using errcode = '55000';
  end if;

  select q.* into v_question
  from public.questions q
  where q.id = p_question_id
    and q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  if v_question.id is null then
    raise exception 'Question is not available for joint preanswers' using errcode = '22023';
  end if;

  insert into public.couple_preanswers (
    event_id,
    question_id,
    choice,
    updated_at
  )
  values (
    v_event_id,
    p_question_id,
    p_choice,
    now()
  )
  on conflict (event_id, question_id) do update
  set choice = excluded.choice,
      updated_at = now();

  return jsonb_build_object(
    'status', 'saved',
    'questionId', p_question_id,
    'choice', p_choice
  );
end;
$$;

create or replace function public.finalize_couple_preanswers(
  p_event_slug text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_access public.couple_preanswer_access%rowtype;
  v_total_count integer := 0;
  v_answered_count integer := 0;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select a.* into v_access
  from public.couple_preanswer_access a
  where a.event_id = v_event_id
  for update;

  if v_access.event_id is null
     or v_access.token_hash <> public._couple_preanswer_token_hash(p_token) then
    raise exception 'Invalid couple preanswer access' using errcode = '42501';
  end if;

  if v_access.consumed_at is not null or v_access.finalized_at is not null then
    return jsonb_build_object('status', 'finished');
  end if;

  select count(*)::integer into v_total_count
  from public.questions q
  where q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  select count(*)::integer into v_answered_count
  from public.couple_preanswers a
  join public.questions q on q.id = a.question_id
  where a.event_id = v_event_id
    and q.event_id = v_event_id
    and q.enabled
    and q.question_type = 'standard';

  if v_total_count = 0 or v_answered_count <> v_total_count then
    raise exception 'Answer every question before finalizing' using errcode = '55000';
  end if;

  update public.couple_preanswer_access
  set finalized_at = now(),
      consumed_at = now(),
      updated_at = now()
  where event_id = v_event_id;

  return jsonb_build_object(
    'status', 'finalized',
    'answerCount', v_answered_count
  );
end;
$$;

revoke all on function public.owner_issue_couple_preanswer_access(uuid) from public;
revoke all on function public.get_couple_preanswer_form(text, text) from public;
revoke all on function public.save_couple_preanswer(text, text, uuid, text) from public;
revoke all on function public.finalize_couple_preanswers(text, text) from public;

grant execute on function public.owner_issue_couple_preanswer_access(uuid) to authenticated;
grant execute on function public.get_couple_preanswer_form(text, text) to anon, authenticated;
grant execute on function public.save_couple_preanswer(text, text, uuid, text) to anon, authenticated;
grant execute on function public.finalize_couple_preanswers(text, text) to anon, authenticated;
