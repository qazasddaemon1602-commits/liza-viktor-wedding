import { throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';
import { BUNKER_V2_GLOBAL_STATES, type BunkerV2GlobalState } from './contracts';

export type TestModeRpcClient = BunkerV2RpcClient;
export type OwnerTestModeState = {
  gameMode: 'idle' | 'test' | 'production';
  globalState: BunkerV2GlobalState | null;
  runActive: boolean;
  guestCount: number;
  realGuestCount: number;
  wagonCount: number;
};

const TEST_ITEMS = ['medkit', 'radio', 'generator', 'tools', 'water', 'gas_mask'] as const;

function uuid(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
}

async function call(
  client: TestModeRpcClient,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'Bunker test mode request failed');
  return data;
}

function parseState(value: unknown): OwnerTestModeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected Bunker rehearsal state');
  }

  const row = value as Record<string, unknown>;
  if (row.gameMode !== 'idle' && row.gameMode !== 'test' && row.gameMode !== 'production') {
    throw new Error('Unexpected Bunker rehearsal mode');
  }

  const globalState = row.globalState === null
    ? null
    : typeof row.globalState === 'string'
      && BUNKER_V2_GLOBAL_STATES.includes(row.globalState as BunkerV2GlobalState)
      ? row.globalState as BunkerV2GlobalState
      : null;

  if (row.globalState !== null && globalState === null) {
    throw new Error('Unexpected Bunker rehearsal stage');
  }

  if (
    typeof row.runActive !== 'boolean'
    || typeof row.guestCount !== 'number'
    || !Number.isInteger(row.guestCount)
    || row.guestCount < 0
    || row.guestCount > 80
    || typeof row.wagonCount !== 'number'
    || !Number.isInteger(row.wagonCount)
    || row.wagonCount < 0
    || row.wagonCount > 5
  ) {
    throw new Error('Unexpected Bunker rehearsal counters');
  }

  const fallbackRealGuestCount = Math.min(row.guestCount, 40);
  const realGuestCount = row.realGuestCount === undefined
    ? fallbackRealGuestCount
    : row.realGuestCount;

  if (
    typeof realGuestCount !== 'number'
    || !Number.isInteger(realGuestCount)
    || realGuestCount < 0
    || realGuestCount > 40
    || realGuestCount > row.guestCount
  ) {
    throw new Error('Unexpected Bunker rehearsal real guest count');
  }

  if (
    (row.runActive && globalState === null)
    || (!row.runActive && globalState !== null)
    || (!row.runActive && row.gameMode !== 'idle')
  ) {
    throw new Error('Unexpected Bunker rehearsal run state');
  }

  return {
    gameMode: row.gameMode,
    globalState,
    runActive: row.runActive,
    guestCount: row.guestCount,
    realGuestCount,
    wagonCount: row.wagonCount,
  };
}

function wagonNumber(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('Test wagon number must be 1..5');
  }
  return value;
}

export async function getOwnerTestModeState(
  client: TestModeRpcClient,
  eventId: string,
): Promise<OwnerTestModeState> {
  return parseState(await call(client, 'get_owner_bunker_v2_test_state', {
    p_event_id: eventId,
  }));
}

export async function seedTestGuests(
  client: TestModeRpcClient,
  eventId: string,
  count: number,
) {
  if (!Number.isInteger(count) || count < 15 || count > 40) {
    throw new Error('Test guest count must be between 15 and 40');
  }
  return call(client, 'owner_bunker_v2_seed_test_guests', {
    p_event_id: eventId,
    p_count: count,
  });
}

export function prepareTestGame(
  client: TestModeRpcClient,
  eventId: string,
  commandId: string = uuid(),
) {
  return call(client, 'owner_prepare_bunker_v2_test', {
    p_event_id: eventId,
    p_command_id: commandId,
  });
}

export async function accelerateTestTimer(
  client: TestModeRpcClient,
  eventId: string,
  seconds = 60,
) {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) {
    throw new Error('Test acceleration must be 1..600 seconds');
  }
  return call(client, 'owner_bunker_v2_test_accelerate', {
    p_event_id: eventId,
    p_seconds: seconds,
  });
}

export function simulateTestStage(client: TestModeRpcClient, eventId: string) {
  return call(client, 'owner_bunker_v2_test_simulate_current', { p_event_id: eventId });
}

export function setTestInventory(
  client: TestModeRpcClient,
  eventId: string,
  wagon: number,
  itemKey: string,
  quantity: number,
) {
  const number = wagonNumber(wagon);
  if (!TEST_ITEMS.includes(itemKey as (typeof TEST_ITEMS)[number])) {
    throw new Error('Unsupported test inventory item');
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9) {
    throw new Error('Test inventory quantity must be 0..9');
  }
  return call(client, 'owner_bunker_v2_test_set_inventory', {
    p_event_id: eventId,
    p_wagon_number: number,
    p_item_key: itemKey,
    p_quantity: quantity,
  });
}

export function setTestWagonState(
  client: TestModeRpcClient,
  eventId: string,
  wagon: number,
  state: {
    power: 'stable' | 'unstable' | 'offline';
    communication: 'working' | 'degraded' | 'offline';
    navigation: 'working' | 'degraded' | 'offline';
  },
) {
  const number = wagonNumber(wagon);
  return call(client, 'owner_bunker_v2_test_set_wagon_state', {
    p_event_id: eventId,
    p_wagon_number: number,
    p_power: state.power,
    p_communication: state.communication,
    p_navigation: state.navigation,
  });
}

export function resetBunkerProgress(client: TestModeRpcClient, eventId: string) {
  return call(client, 'owner_reset_bunker_progress', {
    p_event_id: eventId,
    p_command_id: uuid(),
  });
}

export function resetGameAndRegistrations(
  client: TestModeRpcClient,
  eventId: string,
  confirmation: string,
) {
  if (confirmation !== 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ') {
    return Promise.reject(new Error('Explicit game and registration reset confirmation required'));
  }
  return call(client, 'owner_bunker_v2_reset_game_and_registrations', {
    p_event_id: eventId,
    p_confirmation: confirmation,
  });
}

export function fullEventReset(
  client: TestModeRpcClient,
  eventId: string,
  confirmation: string,
) {
  if (confirmation !== 'СБРОСИТЬ') {
    return Promise.reject(new Error('Explicit full reset confirmation required'));
  }
  return call(client, 'owner_reset_event_test_data', {
    p_event_id: eventId,
    p_confirmation: confirmation,
  });
}