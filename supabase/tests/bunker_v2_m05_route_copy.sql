begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select ok(
  public._bunker_v2_m05_definition()#>>'{routes,1,risk}' ~* 'время|финал',
  'M05 route B copy communicates that the safe detour costs final time'
);

select ok(
  public._bunker_v2_m05_definition()#>>'{routes,1,risk}' !~* 'без временного выигрыша',
  'M05 route B copy no longer implies a zero-minute outcome'
);

select * from finish();
rollback;
