begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid='public.bunker_ability_uses'::regclass
      and constraint_row.contype='u'
      and pg_get_constraintdef(constraint_row.oid)
        ~* 'UNIQUE \(run_nonce, guest_id, ability_key\)'
  ),
  'ability ledger no longer reserves an ability key for the entire run after a rejected commitment'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid='public.bunker_ability_uses'::regclass
      and constraint_row.contype='u'
      and pg_get_constraintdef(constraint_row.oid)
        ~* 'UNIQUE \(run_nonce, guest_id, ability_key, instance_id\)'
  ),
  'ability ledger remains idempotent within one mission instance'
);

select ok(
  pg_get_functiondef('public._submit_bunker_command_m03(text,text,uuid,text,jsonb)'::regprocedure)
    ~ $$set status = 'rejected'$$
  and pg_get_functiondef('public._submit_bunker_command_m03(text,text,uuid,text,jsonb)'::regprocedure)
    !~ $$set ability_uses_remaining = ability_uses_remaining - 1(.|\n)*status = 'rejected'$$,
  'M03 rejection remains a non-consuming commitment outcome'
);

select * from finish();
rollback;
