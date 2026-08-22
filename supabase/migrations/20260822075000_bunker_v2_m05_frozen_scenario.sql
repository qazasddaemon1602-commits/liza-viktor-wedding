-- Forward-only M05 scenario repair.
-- Earlier V2 mission definitions did not persist a scenarioKey, while the approved
-- outcome engine requires one frozen before guests vote. Backfill existing runs and
-- freeze a deterministic key for every future M05 instance.

create or replace function public._bunker_v2_m05_scenario_key(
  p_run_nonce uuid,
  p_scope_key text
)
returns text
language sql
immutable
security definer
set search_path=''
as $$
  select 'route_' || substr(
    pg_catalog.md5(p_run_nonce::text || ':m05:' || coalesce(p_scope_key,'')),
    1,
    12
  );
$$;
revoke all on function public._bunker_v2_m05_scenario_key(uuid,text)
  from public,anon,authenticated;

update public.bunker_mission_instances instance
set definition = jsonb_set(
  coalesce(instance.definition,'{}'::jsonb),
  '{scenario}',
  jsonb_build_object(
    'scenarioKey',
    public._bunker_v2_m05_scenario_key(instance.run_nonce,instance.scope_key)
  ),
  true
)
from public.bunker_game_runs run
where instance.event_id=run.event_id
  and instance.run_nonce=run.run_nonce
  and run.contract_version=2
  and instance.mission_code='MISSION_05'
  and coalesce(instance.definition#>>'{scenario,scenarioKey}','') !~ '^route_[0-9a-f]{12}$';

create or replace function public._bunker_v2_enrich_m05_instance()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_contract integer;
begin
  if new.mission_code<>'MISSION_05' then return new; end if;

  select run.contract_version into v_contract
  from public.bunker_game_runs run
  where run.event_id=new.event_id and run.run_nonce=new.run_nonce;

  if v_contract=2 then
    new.definition:=coalesce(new.definition,'{}'::jsonb)
      || public._bunker_v2_m05_definition();
    new.definition:=jsonb_set(
      new.definition,
      '{scenario}',
      jsonb_build_object(
        'scenarioKey',
        public._bunker_v2_m05_scenario_key(new.run_nonce,new.scope_key)
      ),
      true
    );
  end if;

  return new;
end;
$$;
revoke all on function public._bunker_v2_enrich_m05_instance()
  from public,anon,authenticated;
