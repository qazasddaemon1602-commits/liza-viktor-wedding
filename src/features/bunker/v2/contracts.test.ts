import { describe, expect, it } from 'vitest';
import {
  parseBunkerCommand,
  parseBunkerCommandReceipt,
  parseBunkerV2GuestRuntime,
  parseBunkerV2OwnerRuntime,
  parseBunkerV2Runtime,
  parseBunkerV2State,
} from './contracts';

const activeGuestRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:00:00.000Z',
  state: 'MISSION_01',
  planVersion: 1,
  runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
  viewer: {
    kind: 'guest',
    guest: { id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42', realName: 'Сергей П.' },
    wagon: { number: 2, label: 'Вагон №2' },
  },
  character: {
    profileKey: 'mechanic',
    profileVersion: 2,
    profession: 'МЕХАНИК',
    health: 'отличное',
    visibleSkill: 'ремонт механизмов',
    specialAbility: 'mechanical_fix',
    abilityDescription: 'Открывает отсек.',
    abilityUsesRemaining: 1,
    status: 'active',
    m01Eligibility: 'frozen_member',
    hiddenTraitRevealed: false,
  },
  currentMission: {
    instanceId: '9e7d6779-f551-4c83-8582-0523e7d02171',
    instanceVersion: 1,
    code: 'MISSION_01',
    status: 'active',
    scope: 'wagon',
  },
};

describe('strict Bunker V2 contracts', () => {
  it('accepts UNKNOWN_PASSENGER as a V2 state', () => {
    expect(parseBunkerV2State({ contractVersion: 2, state: 'UNKNOWN_PASSENGER' }).state)
      .toBe('UNKNOWN_PASSENGER');
  });

  it('rejects the legacy-only STORY_BUNKER state and extra state fields', () => {
    expect(() => parseBunkerV2State({ contractVersion: 2, state: 'STORY_BUNKER' })).toThrow();
    expect(() => parseBunkerV2State({
      contractVersion: 2,
      state: 'LOBBY',
      legacyState: 'STORY_BUNKER',
    })).toThrow(/key/i);
  });

  it('omits the hidden trait until reveal and accepts it only after reveal', () => {
    const parsed = parseBunkerV2Runtime(activeGuestRuntime);
    expect(parsed.status).toBe('active');
    if (parsed.status !== 'active' || !('character' in parsed)) throw new Error('fixture');
    expect('hiddenTrait' in parsed.character).toBe(false);

    const revealed = parseBunkerV2Runtime({
      ...activeGuestRuntime,
      character: {
        ...activeGuestRuntime.character,
        hiddenTraitRevealed: true,
        hiddenTrait: 'боится замкнутых пространств',
      },
    });
    if (
      revealed.status !== 'active'
      || !('character' in revealed)
      || !revealed.character.hiddenTraitRevealed
    ) throw new Error('fixture');
    expect(revealed.character.hiddenTrait).toBe('боится замкнутых пространств');
  });

  it('rejects a hidden trait leak and unknown runtime keys at every level', () => {
    expect(() => parseBunkerV2Runtime({ hiddenTrait: 'leak' })).toThrow();
    expect(() => parseBunkerV2Runtime({
      ...activeGuestRuntime,
      character: { ...activeGuestRuntime.character, hiddenTrait: 'leak' },
    })).toThrow(/hidden trait|key/i);
    expect(() => parseBunkerV2Runtime({ ...activeGuestRuntime, guestId: 'authority-leak' }))
      .toThrow(/key/i);
  });

  it('rejects a current mission that disagrees with the authoritative state', () => {
    expect(() => parseBunkerV2Runtime({
      ...activeGuestRuntime,
      currentMission: { ...activeGuestRuntime.currentMission, code: 'MISSION_02' },
    })).toThrow(/mission state/i);
  });

  it.each(['LOBBY', 'CHARACTERS_READY', 'BREAK', 'BUNKER_OPEN', 'FINISHED'])(
    'rejects %s as a mission instance code even when the runtime state matches',
    (state) => {
      expect(() => parseBunkerV2Runtime({
        ...activeGuestRuntime,
        state,
        currentMission: { ...activeGuestRuntime.currentMission, code: state },
      })).toThrow(/mission code/i);
    },
  );

  it('parses active runtimes through viewer-specific guest and owner boundaries', () => {
    const ownerRuntime = {
      contractVersion: 2,
      status: 'active',
      serverNow: '2026-08-21T18:00:00.000Z',
      state: 'MISSION_01',
      planVersion: 1,
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      viewer: { kind: 'owner' },
      currentMission: activeGuestRuntime.currentMission,
    };

    expect(parseBunkerV2GuestRuntime(activeGuestRuntime)).toMatchObject({
      status: 'active', viewer: { kind: 'guest' },
    });
    expect(parseBunkerV2OwnerRuntime(ownerRuntime)).toMatchObject({
      status: 'active', viewer: { kind: 'owner' },
    });
    expect(() => parseBunkerV2GuestRuntime(ownerRuntime)).toThrow(/guest viewer/i);
    expect(() => parseBunkerV2OwnerRuntime(activeGuestRuntime)).toThrow(/owner viewer/i);
  });

  it('parses every closed guest command variant', () => {
    const commands = [
      { type: 'mission_confirm', payload: { instanceId: 'instance-1', instanceVersion: 1, selection: ['guest-1'] } },
      { type: 'submit_answer', payload: { instanceId: 'instance-2', answers: ['Вагон №4', '05'] } },
      { type: 'use_ability', payload: { instanceId: 'instance-3', problemKey: 'power' } },
      { type: 'send_message', payload: { instanceId: 'instance-4', message: 'Подтвердите сектор 04' } },
      { type: 'propose_trade', payload: { instanceId: 'instance-4', targetWagonNumber: 3, itemKey: 'radio', quantity: 1 } },
      { type: 'respond_trade', payload: { instanceId: 'instance-4', transferId: 'transfer-1', response: 'accept' } },
      { type: 'cast_vote', payload: { instanceId: 'instance-6', vote: 'route-a' } },
      { type: 'reveal_fragment', payload: { instanceId: 'instance-6', fragmentKey: 'sector' } },
      { type: 'request_access', payload: { coordinates: '57°09 / 65°32', sector: '04', accessCode: '4719', gateTime: '23:40', password: 'LV0830' } },
    ] as const;

    expect(commands.map((command) => parseBunkerCommand(command).type)).toEqual([
      'mission_confirm', 'submit_answer', 'use_ability', 'send_message', 'propose_trade',
      'respond_trade', 'cast_vote', 'reveal_fragment', 'request_access',
    ]);
  });

  it('rejects unknown commands, extra keys, and authority-bearing payload fields', () => {
    expect(() => parseBunkerCommand({ type: 'owner_transition', payload: {} })).toThrow(/command/i);
    expect(() => parseBunkerCommand({
      type: 'use_ability',
      payload: { instanceId: 'instance-3', problemKey: 'power', guestId: 'guest-1' },
    })).toThrow(/key/i);
    expect(() => parseBunkerCommand({
      type: 'request_access',
      payload: {
        coordinates: '57°09 / 65°32', sector: '04', accessCode: '4719', gateTime: '23:40',
        password: 'LV0830', outcome: 'open',
      },
    })).toThrow(/key/i);
  });

  it('parses only the closed receipt shape', () => {
    expect(parseBunkerCommandReceipt({
      contractVersion: 2,
      status: 'accepted',
      commandId: 'command-1',
      commandType: 'cast_vote',
    })).toEqual({
      contractVersion: 2,
      status: 'accepted',
      commandId: 'command-1',
      commandType: 'cast_vote',
    });
    expect(() => parseBunkerCommandReceipt({
      contractVersion: 2,
      status: 'accepted',
      commandId: 'command-1',
      commandType: 'cast_vote',
      runNonce: 'authority-leak',
    })).toThrow(/key/i);
  });
});
