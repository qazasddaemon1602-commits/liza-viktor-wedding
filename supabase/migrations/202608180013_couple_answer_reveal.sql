alter table public.quiz_state
  add column couple_answer_revealed_at timestamptz;

create or replace function public._reset_couple_answer_reveal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_question_id is distinct from old.current_question_id
     or (new.phase = 'voting' and old.phase is distinct from 'voting') then
    new.couple_answer_revealed_at := null;
  end if;
  return new;
end;
$$;

create trigger quiz_state_reset_couple_answer_reveal
before update on public.quiz_state
for each row
execute function public._reset_couple_answer_reveal();

create or replace function public.owner_get_couple_reveal_status(
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
  v_ready boolean := false;
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

  if not exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and q.event_id = p_event_id
      and q.enabled
      and q.question_type = 'standard'
  ) then
    return jsonb_build_object('status', 'not_ready', 'revealed', false);
  end if;

  select qs.current_question_id, qs.phase, qs.couple_answer_revealed_at
  into v_current_question_id, v_phase, v_revealed_at
  from public.quiz_state qs
  where qs.event_id = p_event_id;

  if v_current_question_id is distinct from p_question_id then
    return jsonb_build_object('status', 'not_ready', 'revealed', false);
  end if;

  if v_revealed_at is not null then
    return jsonb_build_object('status', 'revealed', 'revealed', true);
  end if;

  if v_phase = 'results' then
    select exists (
      select 1
      from public.couple_preanswer_access a
      join public.couple_preanswers p
        on p.event_id = a.event_id
       and p.question_id = p_question_id
      where a.event_id = p_event_id
        and a.finalized_at is not null
    ) into v_ready;
  end if;

  if v_ready then
    return jsonb_build_object('status', 'ready', 'revealed', false);
  end if;

  return jsonb_build_object('status', 'not_ready', 'revealed', false);
end;
$$;

create or replace function public.owner_reveal_couple_preanswer(
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
  v_phase text;
  v_current_question_id uuid;
  v_revealed_at timestamptz;
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

  select qs.phase, qs.current_question_id, qs.couple_answer_revealed_at
  into v_phase, v_current_question_id, v_revealed_at
  from public.quiz_state qs
  where qs.event_id = p_event_id
  for update;

  if v_current_question_id is distinct from p_question_id
     or v_phase <> 'results' then
    raise exception 'guest results must be revealed first' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and q.event_id = p_event_id
      and q.enabled
      and q.question_type = 'standard'
  ) then
    raise exception 'standard question required' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.couple_preanswer_access a
    join public.couple_preanswers p
      on p.event_id = a.event_id
     and p.question_id = p_question_id
    where a.event_id = p_event_id
      and a.finalized_at is not null
  ) then
    raise exception 'finalized couple preanswer required' using errcode = '55000';
  end if;

  update public.quiz_state
  set couple_answer_revealed_at = coalesce(couple_answer_revealed_at, now()),
      updated_at = now()
  where event_id = p_event_id
    and current_question_id = p_question_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'couple_preanswer_revealed',
    jsonb_build_object('questionId', p_question_id)
  );

  return jsonb_build_object(
    'status', 'revealed',
    'questionId', p_question_id
  );
end;
$$;

create or replace function public.get_revealed_couple_answer(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_question_id uuid;
  v_phase text := 'idle';
  v_revealed_at timestamptz;
  v_choice text;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select qs.current_question_id, qs.phase, qs.couple_answer_revealed_at
  into v_question_id, v_phase, v_revealed_at
  from public.quiz_state qs
  where qs.event_id = v_event_id;

  if v_question_id is null
     or v_phase <> 'results'
     or v_revealed_at is null then
    return jsonb_build_object('status', 'hidden');
  end if;

  if not exists (
    select 1
    from public.questions q
    where q.id = v_question_id
      and q.event_id = v_event_id
      and q.enabled
      and q.question_type = 'standard'
  ) then
    return jsonb_build_object('status', 'hidden');
  end if;

  select p.choice into v_choice
  from public.couple_preanswers p
  join public.couple_preanswer_access a
    on a.event_id = p.event_id
  where p.event_id = v_event_id
    and p.question_id = v_question_id
    and a.finalized_at is not null;

  if v_choice is null then
    return jsonb_build_object('status', 'hidden');
  end if;

  return jsonb_build_object(
    'status', 'revealed',
    'questionId', v_question_id,
    'choice', v_choice
  );
end;
$$;

revoke all on function public._reset_couple_answer_reveal() from public, anon, authenticated;
revoke all on function public.owner_get_couple_reveal_status(uuid, uuid) from public, anon;
revoke all on function public.owner_reveal_couple_preanswer(uuid, uuid) from public, anon;
revoke all on function public.get_revealed_couple_answer(text) from public;

grant execute on function public.owner_get_couple_reveal_status(uuid, uuid) to authenticated;
grant execute on function public.owner_reveal_couple_preanswer(uuid, uuid) to authenticated;
grant execute on function public.get_revealed_couple_answer(text) to anon, authenticated;
