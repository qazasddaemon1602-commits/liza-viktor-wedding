-- Reset-command receipts live outside the run graph so an ambiguous transport
-- retry can still return the original result after the run itself is removed.
create table public.bunker_progress_reset_receipts (
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  command_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (event_id, actor_id, command_id)
);

alter table public.bunker_progress_reset_receipts enable row level security;
revoke all on table public.bunker_progress_reset_receipts
  from public, anon, authenticated;

create or replace function public.owner_reset_bunker_progress(
  p_event_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.bunker_state%rowtype;
  v_run_nonce uuid;
  v_request_hash text;
  v_existing_receipt public.bunker_progress_reset_receipts%rowtype;
  v_result jsonb;
begin
  if p_command_id is null then
    raise exception 'Bunker reset command id is required' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  insert into public.bunker_state(event_id)
  values (p_event_id)
  on conflict (event_id) do nothing;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  -- Serialize on bunker_state first, then perform a plain ownership recheck.
  -- This matches the V2 owner-command lock order without an events row lock.
  perform 1
  from public.events event
  where event.id = p_event_id and event.owner_user_id = v_owner;
  if not found then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'commandType', 'owner_reset_run',
          'eventId', p_event_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select receipt.*
  into v_existing_receipt
  from public.bunker_progress_reset_receipts receipt
  where receipt.event_id = p_event_id
    and receipt.actor_id = v_owner
    and receipt.command_id = p_command_id;
  if v_existing_receipt.command_id is not null then
    if v_existing_receipt.request_hash <> v_request_hash then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return v_existing_receipt.result;
  end if;

  v_run_nonce := v_state.run_nonce;

  update public.bunker_state
  set status = 'idle',
      started_at = null,
      duration_seconds = 1800,
      phase = 'emergency',
      phase_started_at = null,
      unlocked_at = null,
      run_nonce = null,
      global_game_state = 'LOBBY',
      final_started_at = null,
      final_duration = 1800,
      bunker_revealed = false,
      updated_at = clock_timestamp()
  where event_id = p_event_id;

  update public.event_state
  set current_module = 'idle',
      screen_mode = 'idle',
      screen_payload_id = null,
      screen_payload = null,
      screen_pinned = false,
      updated_at = clock_timestamp()
  where event_id = p_event_id
    and (
      current_module = 'bunker'
      or screen_mode like 'bunker%'
    );

  v_result := jsonb_build_object(
    'status', 'reset',
    'state', 'LOBBY',
    'hadActiveRun', v_run_nonce is not null,
    'runNonce', v_run_nonce
  );

  insert into public.bunker_progress_reset_receipts(
    event_id, actor_id, command_id, request_hash, result
  )
  values (
    p_event_id, v_owner, p_command_id, v_request_hash, v_result
  );

  insert into public.owner_action_log(
    event_id, owner_user_id, action, payload
  )
  values (
    p_event_id,
    v_owner,
    'bunker_progress_reset',
    jsonb_build_object(
      'commandId', p_command_id,
      'runNonce', v_run_nonce,
      'hadActiveRun', v_run_nonce is not null
    )
  );

  return v_result;
end;
$$;

revoke all on function public.owner_reset_bunker_progress(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.owner_reset_bunker_progress(uuid, uuid)
  to authenticated;
