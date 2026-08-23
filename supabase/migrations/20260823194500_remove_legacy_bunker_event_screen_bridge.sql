-- `bunker_v2_state_screen_sync_trigger` is the authoritative projector bridge.
-- The older bunker_game_events bridge runs later during owner transitions and
-- can overwrite richer state routing (notably FINISHED -> bunker_results) with
-- the generic `bunker` mode. Remove the duplicate only after verifying the
-- state-based bridge is present.

do $$
begin
  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class target on target.oid = trigger_row.tgrelid
    join pg_namespace schema_row on schema_row.oid = target.relnamespace
    where schema_row.nspname = 'public'
      and target.relname = 'bunker_state'
      and trigger_row.tgname = 'bunker_v2_state_screen_sync_trigger'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'authoritative Bunker V2 state screen bridge is missing';
  end if;
end;
$$;

drop trigger if exists bunker_v2_screen_bridge_trigger
on public.bunker_game_events;

drop function if exists public.sync_bunker_v2_screen_state();

-- Keep this statement in the migration contract so review/testing makes the
-- surviving authority explicit.
do $$
begin
  if to_regprocedure('public.sync_bunker_v2_state_to_screen()') is null then
    raise exception 'sync_bunker_v2_state_to_screen is missing';
  end if;
end;
$$;
