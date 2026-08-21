begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select has_table('public', 'premiere_state', 'premiere state table exists');
select has_column('public', 'premiere_state', 'media_url', 'premiere stores a deploy-safe video URL');
select has_column('public', 'premiere_state', 'duration_seconds', 'premiere tracks media duration');
select has_column('public', 'premiere_state', 'status', 'premiere tracks authoritative status');
select has_column('public', 'premiere_state', 'start_at', 'premiere stores one authoritative countdown start timestamp');
select has_column('public', 'premiere_state', 'playback_anchor_at', 'premiere tracks synchronized playback anchor');
select has_column('public', 'premiere_state', 'playback_offset_seconds', 'premiere tracks synchronized playback offset');
select has_column('public', 'premiere_state', 'countdown_seconds', 'premiere tracks countdown length');
select has_column('public', 'premiere_state', 'countdown_sound_enabled', 'premiere stores owner countdown sound preference');

select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_set_premiere_media'), 'owner can configure video URL');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_get_premiere_control'), 'owner can read premiere readiness/control state');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_set_premiere_standby'), 'owner can arm premiere standby');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_start_premiere'), 'owner can schedule authoritative countdown');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_cancel_premiere'), 'owner can cancel countdown/playback');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_pause_premiere'), 'owner can pause synchronized playback');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_resume_premiere'), 'owner can resume synchronized playback');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_seek_premiere'), 'owner can seek playback');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_restart_premiere'), 'owner can restart playback');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_set_premiere_black'), 'owner can force black screen');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_return_main_screen'), 'owner can return displays to main screen');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='owner_set_premiere_countdown_sound'), 'owner can toggle countdown sound');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_premiere_screen_state'), 'presentation screens have a safe premiere state RPC');

select ok(not has_table_privilege('anon', 'public.premiere_state', 'SELECT'), 'anonymous screens cannot read raw premiere table');
select ok(not has_function_privilege('anon', 'public.owner_start_premiere(uuid,integer)', 'EXECUTE'), 'anonymous clients cannot start premiere');
select ok(has_function_privilege('anon', 'public.get_premiere_screen_state(text)', 'EXECUTE'), 'anonymous displays can read only safe premiere state');

select * from finish();
rollback;
