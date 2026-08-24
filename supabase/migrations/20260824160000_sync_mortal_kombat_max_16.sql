-- Forward-only production sync for the event-day Mortal Kombat contract.
-- The canonical 16-player migration exists earlier in history, but production
-- missed it. Keep this patch idempotent so fresh databases can also apply it.

do $$
begin
  if exists (
    select 1
    from public.mk_tournaments t
    where t.state in ('active', 'complete')
      and (
        (select count(*)
         from public.mk_registrations r
         where r.tournament_id = t.id
           and r.status = 'active') > 16
        or exists (
          select 1
          from public.mk_matches m
          where m.tournament_id = t.id
            and m.round in ('r64', 'r32')
        )
      )
  ) then
    raise exception 'MK_MAX_16_REQUIRES_RESET' using errcode = '55000';
  end if;
end;
$$;

update public.mk_registrations r
set seed = null,
    updated_at = now()
from public.mk_tournaments t
where t.id = r.tournament_id
  and t.state in ('registration', 'draw_ready')
  and r.status in ('active', 'waitlist')
  and r.seed is not null;

with ranked as (
  select
    r.id,
    row_number() over (
      partition by r.tournament_id
      order by r.registered_at, r.id
    ) as registration_rank
  from public.mk_registrations r
  join public.mk_tournaments t on t.id = r.tournament_id
  where t.state in ('registration', 'draw_ready')
    and r.status = 'active'
)
update public.mk_registrations r
set status = 'waitlist',
    seed = null,
    updated_at = now()
from ranked
where ranked.id = r.id
  and ranked.registration_rank > 16;

delete from public.mk_matches m
using public.mk_tournaments t
where t.id = m.tournament_id
  and t.state in ('registration', 'draw_ready');

alter table public.mk_tournaments
  drop constraint if exists mk_tournaments_max_players_check;

alter table public.mk_tournaments
  alter column max_players set default 16;

update public.mk_tournaments
set max_players = 16
where max_players <> 16;

alter table public.mk_tournaments
  add constraint mk_tournaments_max_players_check
  check (max_players = 16);

alter table public.mk_registrations
  drop constraint if exists mk_registrations_seed_check;

alter table public.mk_registrations
  add constraint mk_registrations_seed_check
  check (seed is null or seed between 1 and 16);

alter table public.mk_matches
  drop constraint if exists mk_matches_round_check;

alter table public.mk_matches
  add constraint mk_matches_round_check
  check (round in ('r16', 'qf', 'sf', 'final'));

create or replace function public.owner_open_mk_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  perform public._require_mk_owner(p_event_id);

  insert into public.mk_tournaments(event_id, state, max_players, updated_at)
  values (p_event_id, 'registration', 16, now())
  on conflict (event_id) do update
  set state = case
        when mk_tournaments.state in ('active', 'complete') then mk_tournaments.state
        else 'registration'
      end,
      max_players = 16,
      updated_at = now()
  returning id into v_tournament_id;

  if exists (
    select 1
    from public.mk_tournaments t
    where t.id = v_tournament_id
      and t.state in ('active', 'complete')
  ) then
    raise exception 'started tournament cannot reopen registration' using errcode = '55000';
  end if;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (p_event_id, auth.uid(), 'mk_registration_opened', '{}'::jsonb);

  return jsonb_build_object(
    'status', 'registration',
    'tournamentId', v_tournament_id,
    'maxPlayers', 16
  );
end;
$$;

create or replace function public.owner_randomize_mk_seeds(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.mk_tournaments%rowtype;
  v_count integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  select t.* into v_tournament
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament.id is null then
    raise exception 'MK tournament not found' using errcode = 'P0002';
  end if;

  if v_tournament.state not in ('registration', 'draw_ready') then
    raise exception 'MK draw is already locked' using errcode = '55000';
  end if;

  select count(*)::integer into v_count
  from public.mk_registrations r
  where r.tournament_id = v_tournament.id
    and r.status = 'active';

  if v_count = 0 then
    raise exception 'no active MK players' using errcode = '55000';
  end if;

  if v_count > 16 then
    raise exception 'between 1 and 16 active players required' using errcode = '55000';
  end if;

  update public.mk_registrations
  set seed = null,
      updated_at = now()
  where tournament_id = v_tournament.id
    and status = 'active';

  with shuffled as (
    select
      r.id,
      row_number() over(order by random())::integer as next_seed
    from public.mk_registrations r
    where r.tournament_id = v_tournament.id
      and r.status = 'active'
  )
  update public.mk_registrations r
  set seed = s.next_seed,
      updated_at = now()
  from shuffled s
  where s.id = r.id;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'mk_seeds_randomized',
    jsonb_build_object('activeCount', v_count)
  );

  return jsonb_build_object('status', 'randomized', 'activeCount', v_count);
end;
$$;

create or replace function public._mk_next_match(p_round text, p_position integer)
returns table(next_round text, next_position integer, next_slot text)
language sql
immutable
set search_path = ''
as $$
  select
    case p_round
      when 'r16' then 'qf'
      when 'qf' then 'sf'
      when 'sf' then 'final'
      else null
    end,
    case
      when p_round = 'final' then null
      else ceil(p_position / 2.0)::integer
    end,
    case
      when p_round = 'final' then null
      when p_position % 2 = 1 then 'player1'
      else 'player2'
    end;
$$;

revoke all on function public.owner_open_mk_registration(uuid) from public, anon;
revoke all on function public.owner_randomize_mk_seeds(uuid) from public, anon;
revoke all on function public._mk_next_match(text, integer) from public, anon, authenticated;

grant execute on function public.owner_open_mk_registration(uuid) to authenticated;
grant execute on function public.owner_randomize_mk_seeds(uuid) to authenticated;
