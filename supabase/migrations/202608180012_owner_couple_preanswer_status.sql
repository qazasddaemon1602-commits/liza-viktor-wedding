create or replace function public.owner_get_couple_preanswer_status(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_access public.couple_preanswer_access%rowtype;
  v_total_count integer := 0;
  v_answered_count integer := 0;
begin
  select e.* into v_event
  from public.events e
  where e.id = p_event_id;

  if v_event.id is null or v_event.owner_user_id is distinct from auth.uid() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  select count(*)::integer into v_total_count
  from public.questions q
  where q.event_id = p_event_id
    and q.enabled
    and q.question_type = 'standard';

  select count(*)::integer into v_answered_count
  from public.couple_preanswers a
  join public.questions q on q.id = a.question_id
  where a.event_id = p_event_id
    and q.event_id = p_event_id
    and q.enabled
    and q.question_type = 'standard';

  select a.* into v_access
  from public.couple_preanswer_access a
  where a.event_id = p_event_id;

  if v_access.event_id is null then
    return jsonb_build_object(
      'status', 'not_issued',
      'answeredCount', v_answered_count,
      'totalCount', v_total_count,
      'issuedAt', null,
      'finalizedAt', null
    );
  end if;

  if v_access.finalized_at is not null or v_access.consumed_at is not null then
    return jsonb_build_object(
      'status', 'finalized',
      'answeredCount', v_answered_count,
      'totalCount', v_total_count,
      'issuedAt', v_access.issued_at,
      'finalizedAt', coalesce(v_access.finalized_at, v_access.consumed_at)
    );
  end if;

  return jsonb_build_object(
    'status', 'active',
    'answeredCount', v_answered_count,
    'totalCount', v_total_count,
    'issuedAt', v_access.issued_at,
    'finalizedAt', null
  );
end;
$$;

revoke all on function public.owner_get_couple_preanswer_status(uuid) from public;
grant execute on function public.owner_get_couple_preanswer_status(uuid) to authenticated;
