import {
  parseBunkerV2GuestRuntime,
  type BunkerCommandReceipt,
  type BunkerV2ActiveGuestRuntime,
  type BunkerV2CurrentMission,
} from './contracts';
import {
  submitBunkerCommand,
  type BunkerV2RpcClient,
} from './command.service';

export type MissionOneRpcClient = BunkerV2RpcClient;

export type MissionOneGuestRuntime = BunkerV2ActiveGuestRuntime & {
  state: 'MISSION_01';
  currentMission: BunkerV2CurrentMission & {
    code: 'MISSION_01';
    scope: 'wagon';
  };
};

export type ConfirmMissionOneSelectionInput = {
  eventSlug: string;
  deviceKey: string;
  commandId: string;
  instanceId: string;
  instanceVersion: number;
  selectedGuestIds: readonly string[];
};

export function parseMissionOneGuestRuntime(value: unknown): MissionOneGuestRuntime {
  const runtime = parseBunkerV2GuestRuntime(value);
  if (
    runtime.status !== 'active'
    || runtime.state !== 'MISSION_01'
    || runtime.currentMission?.code !== 'MISSION_01'
    || runtime.currentMission.scope !== 'wagon'
  ) {
    throw new Error('Unexpected Bunker V2 mission one runtime');
  }
  return runtime as MissionOneGuestRuntime;
}

export async function confirmMissionOneSelection(
  client: MissionOneRpcClient,
  input: ConfirmMissionOneSelectionInput,
): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(
    client,
    input.eventSlug,
    input.deviceKey,
    input.commandId,
    {
      type: 'mission_confirm',
      payload: {
        instanceId: input.instanceId,
        instanceVersion: input.instanceVersion,
        selection: [...input.selectedGuestIds],
      },
    },
  );
}
