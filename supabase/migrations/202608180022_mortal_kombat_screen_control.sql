create or replace function public.owner_show_mk_bracket(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_state text;
begin
  perform public._require_mk_owner(p_event_id);

  select t.id, t.state
  into v_tournament_id, v_state
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament_id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  if v_state <> 'active' then
    raise exception 'MK tournament is not active' using errcode = '55000';
  end if;

  update public.mk_tournaments
  set current_match_id = null,
      updated_at = now()
  where id = v_tournament_id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_bracket_shown', '{}'::jsonb);

  return jsonb_build_object('status', 'bracket');
end;
$$;

revoke all on function public.owner_show_mk_bracket(uuid) from public, anon;
grant execute on function public.owner_show_mk_bracket(uuid) to authenticated;
