-- Forward-only projection consistency.
-- A mission instance is authoritative. Keep frozen member status aligned when
-- the instance closes through a normal command, timeout/fallback, or owner transition.

create or replace function public._sync_bunker_v2_member_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'completed' then
    update public.bunker_mission_members member
    set member_status = 'completed',
        updated_at = now()
    where member.instance_id = new.id
      and member.member_status <> 'completed';
  elsif new.status = 'expired' then
    update public.bunker_mission_members member
    set member_status = 'expired',
        updated_at = now()
    where member.instance_id = new.id
      and member.member_status not in ('completed','expired');
  end if;

  return new;
end;
$$;

revoke all on function public._sync_bunker_v2_member_status()
  from public,anon,authenticated;

drop trigger if exists bunker_v2_sync_member_status on public.bunker_mission_instances;
create trigger bunker_v2_sync_member_status
after update of status on public.bunker_mission_instances
for each row
when (old.status is distinct from new.status)
execute function public._sync_bunker_v2_member_status();
