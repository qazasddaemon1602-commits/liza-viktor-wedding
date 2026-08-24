-- Keep the MK API readable during a rolling deployment and make the first real
-- fight authoritative immediately after the draw is finalized.

create or replace function public._normalize_mk_current_flags(p_projection jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_matches jsonb;
begin
  if jsonb_typeof(p_projection->'matches') is distinct from 'array' then
    return p_projection;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_set(
        match_item,
        '{current}',
        to_jsonb(coalesce((match_item->>'current')::boolean, false)),
        true
      )
      order by ordinal_position
    ),
    '[]'::jsonb
  )
  into v_matches
  from jsonb_array_elements(p_projection->'matches')
    with ordinality as projected_match(match_item, ordinal_position);

  return jsonb_set(p_projection, '{matches}', v_matches, true);
end;
$$;

revoke all on function public._normalize_mk_current_flags(jsonb) from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public._get_mk_tournament_state_before_current_boolean(text,text)') is null then
    alter function public.get_mk_tournament_state(text, text)
      rename to _get_mk_tournament_state_before_current_boolean;
  end if;
end;
$$;

revoke all on function public._get_mk_tournament_state_before_current_boolean(text, text)
  from public, anon, authenticated;

create or replace function public.get_mk_tournament_state(
  p_event_slug text,
  p_device_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._normalize_mk_current_flags(
    public._get_mk_tournament_state_before_current_boolean(p_event_slug, p_device_key)
  );
end;
$$;

revoke all on function public.get_mk_tournament_state(text, text) from public;
grant execute on function public.get_mk_tournament_state(text, text) to anon, authenticated;

do $$
begin
  if to_regprocedure('public._owner_get_mk_control_before_current_boolean(uuid)') is null then
    alter function public.owner_get_mk_control(uuid)
      rename to _owner_get_mk_control_before_current_boolean;
  end if;
end;
$$;

revoke all on function public._owner_get_mk_control_before_current_boolean(uuid)
  from public, anon, authenticated;

create or replace function public.owner_get_mk_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._normalize_mk_current_flags(
    public._owner_get_mk_control_before_current_boolean(p_event_id)
  );
end;
$$;

revoke all on function public.owner_get_mk_control(uuid) from public, anon;
grant execute on function public.owner_get_mk_control(uuid) to authenticated;

do $$
begin
  if to_regprocedure('public._owner_finalize_mk_draw_before_auto_current(uuid)') is null then
    alter function public.owner_finalize_mk_draw(uuid)
      rename to _owner_finalize_mk_draw_before_auto_current;
  end if;
end;
$$;

revoke all on function public._owner_finalize_mk_draw_before_auto_current(uuid)
  from public, anon, authenticated;

create or replace function public.owner_finalize_mk_draw(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_tournament public.mk_tournaments%rowtype;
  v_active_count integer;
  v_first_ready_match_id uuid;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id;

  if v_tournament.id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id
    and r.status = 'active';

  if v_active_count < 2 or v_active_count > 16 then
    raise exception 'between 2 and 16 active players required' using errcode = '55000';
  end if;

  v_result := public._owner_finalize_mk_draw_before_auto_current(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  select m.id into v_first_ready_match_id
  from public.mk_matches m
  where m.tournament_id = v_tournament.id
    and m.status = 'ready'
    and m.player1_guest_id is not null
    and m.player2_guest_id is not null
  order by
    case m.round
      when 'r16' then 1
      when 'qf' then 2
      when 'sf' then 3
      when 'final' then 4
      else 5
    end,
    m.position,
    m.id
  limit 1;

  if v_first_ready_match_id is null then
    raise exception 'invalid MK bracket: no real ready match' using errcode = '55000';
  end if;

  update public.mk_tournaments
  set current_match_id = v_first_ready_match_id,
      updated_at = now()
  where id = v_tournament.id;

  return v_result || jsonb_build_object('currentMatchId', v_first_ready_match_id);
end;
$$;

revoke all on function public.owner_finalize_mk_draw(uuid) from public, anon;
grant execute on function public.owner_finalize_mk_draw(uuid) to authenticated;

-- Repair an already-started two-player or small rehearsal that was finalized
-- before automatic current-fight selection shipped.
with first_ready as (
  select distinct on (m.tournament_id)
    m.tournament_id,
    m.id as match_id
  from public.mk_matches m
  where m.status = 'ready'
    and m.player1_guest_id is not null
    and m.player2_guest_id is not null
  order by
    m.tournament_id,
    case m.round
      when 'r16' then 1
      when 'qf' then 2
      when 'sf' then 3
      when 'final' then 4
      else 5
    end,
    m.position,
    m.id
)
update public.mk_tournaments tournament
set current_match_id = first_ready.match_id,
    updated_at = now()
from first_ready
where tournament.id = first_ready.tournament_id
  and tournament.state = 'active'
  and tournament.current_match_id is null;
