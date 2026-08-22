-- Forward-only ability-ledger correction.
-- A rejected M03 commitment does not consume ability_uses_remaining, so it must
-- not reserve that ability key for every later mission in the same run.

alter table public.bunker_ability_uses
  drop constraint if exists bunker_ability_uses_run_nonce_guest_id_ability_key_key;

alter table public.bunker_ability_uses
  drop constraint if exists bunker_ability_uses_instance_unique;

alter table public.bunker_ability_uses
  add constraint bunker_ability_uses_instance_unique
  unique (run_nonce, guest_id, ability_key, instance_id);
