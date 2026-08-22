begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_trigger(
  'public',
  'bunker_state',
  'bunker_v2_clear_game_run_on_reset',
  'reset cleanup is attached to bunker_state run nonce changes'
);

select ok(
  coalesce((
    select upper(pg_get_triggerdef(trigger.oid)) ~ 'AFTER UPDATE OF RUN_NONCE ON'
    from pg_trigger trigger
    where trigger.tgrelid = 'public.bunker_state'::regclass
      and trigger.tgname = 'bunker_v2_clear_game_run_on_reset'
      and not trigger.tgisinternal
  ), false),
  'reset cleanup runs after the authoritative run nonce is detached'
);

select ok(
  coalesce((
    select pg_get_triggerdef(trigger.oid) ~ '_clear_bunker_game_run_on_reset'
    from pg_trigger trigger
    where trigger.tgrelid = 'public.bunker_state'::regclass
      and trigger.tgname = 'bunker_v2_clear_game_run_on_reset'
      and not trigger.tgisinternal
  ), false),
  'reset cleanup invokes the dependency-safe V2 run cleanup function'
);

select * from finish();
rollback;
