import { describe, expect, it, vi } from 'vitest';
import {
  advanceBunkerPhase,
  beginBunkerQuest,
  forceCompleteBunkerTeamStage,
  getGuestBunkerQuest,
  getOwnerBunkerQuest,
  resetBunkerTeamStage,
  submitBunkerFinalCode,
  submitBunkerMission,
  unlockBunker,
} from './bunkerQuest.service';
import type { BunkerRpcClient } from './bunker.service';

function clientWith(data: unknown): BunkerRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

const guestActive = {
  status: 'active',
  phase: 'mission_a',
  phaseStartedAt: '2026-08-30T18:02:00.000Z',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1680,
  serverNow: '2026-08-30T18:02:00.000Z',
  dossier: {
    profession: 'АРХИТЕКТОР',
    profile: '31 ГОД · ЛЮБИТ ПОРЯДОК',
    health: 'НЕ ЛЮБИТ ХОЛОД',
    hobby: 'ШАХМАТЫ',
    baggage: 'АПТЕЧКА',
    hiddenFact: 'ЗНАЕТ АЗБУКУ МОРЗЕ',
    abilityTags: ['technical', 'analytical'],
  },
  team: {
    carriageNumber: 3,
    stage: 'mission_a',
    mission: {
      title: 'ДАВЛЕНИЕ · ВАГОН 03',
      prompt: 'Выберите безопасное значение',
      options: ['3', '7', '11'],
    },
    completed: false,
    attemptCount: 1,
    fragment: null,
  },
  final: { unlocked: false },
};

describe('Bunker quest service', () => {
  it('parses authoritative guest quest state without exposing hidden server answers', async () => {
    const client = clientWith(guestActive);

    await expect(getGuestBunkerQuest(client, 'liza-viktor', 'device-key-123')).resolves.toMatchObject({
      status: 'active',
      phase: 'mission_a',
      remainingSeconds: 1680,
      dossier: { profession: 'АРХИТЕКТОР', abilityTags: ['technical', 'analytical'] },
      team: { carriageNumber: 3, completed: false },
    });

    expect(client.rpc).toHaveBeenCalledWith('get_guest_bunker_state', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-key-123',
    });
    expect(JSON.stringify(await getGuestBunkerQuest(client, 'liza-viktor', 'device-key-123'))).not.toContain('correctAnswer');
  });

  it('keeps later dossier fields nullable during the first reveal', async () => {
    const client = clientWith({
      ...guestActive,
      phase: 'dossier_1',
      dossier: {
        profession: 'АРХИТЕКТОР',
        profile: '31 ГОД · ЛЮБИТ ПОРЯДОК',
        health: null,
        hobby: null,
        baggage: null,
        hiddenFact: null,
        abilityTags: ['technical'],
      },
      team: null,
    });

    const result = await getGuestBunkerQuest(client, 'liza-viktor', 'device-key-123');
    expect(result).toMatchObject({
      status: 'active',
      phase: 'dossier_1',
      dossier: { health: null, hiddenFact: null },
    });
  });

  it('rejects malformed phase/timestamps instead of guessing', async () => {
    const badPhase = clientWith({ ...guestActive, phase: 'unknown' });
    await expect(getGuestBunkerQuest(badPhase, 'liza-viktor', 'device-key-123'))
      .rejects.toThrow(/Bunker/i);

    const badDate = clientWith({ ...guestActive, serverNow: 'not-a-date' });
    await expect(getGuestBunkerQuest(badDate, 'liza-viktor', 'device-key-123'))
      .rejects.toThrow(/timestamp/i);
  });

  it('wires guest mission and final-code submissions', async () => {
    const missionClient = clientWith({ status: 'completed', stage: 'mission_a', attemptCount: 1 });
    await submitBunkerMission(missionClient, 'liza-viktor', 'device-key-123', 'mission_a', '7');
    expect(missionClient.rpc).toHaveBeenCalledWith('submit_guest_bunker_mission', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-key-123',
      p_stage: 'mission_a',
      p_answer: '7',
    });

    const finalClient = clientWith({ status: 'unlocked', unlocked: true });
    await submitBunkerFinalCode(finalClient, 'liza-viktor', 'device-key-123', '1122334455');
    expect(finalClient.rpc).toHaveBeenCalledWith('submit_guest_bunker_final_code', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-key-123',
      p_code: '1122334455',
    });
  });

  it('parses owner progress and wires pacing/fallback commands', async () => {
    const ownerState = {
      status: 'active',
      phase: 'mission_a',
      phaseStartedAt: '2026-08-30T18:02:00.000Z',
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1680,
      soundEnabled: true,
      unlocked: false,
      teams: [{
        carriageId: 'carriage-1',
        carriageNumber: 1,
        label: 'ВАГОН №1',
        missionA: { completed: true, attemptCount: 1, hint: 'hint A' },
        missionB: { completed: false, attemptCount: 0, fragment: null, hint: 'hint B' },
      }],
      serverNow: '2026-08-30T18:02:00.000Z',
    };
    const client = clientWith(ownerState);

    await expect(getOwnerBunkerQuest(client, 'event-1')).resolves.toMatchObject({
      status: 'active',
      phase: 'mission_a',
      teams: [{ carriageNumber: 1, missionA: { completed: true } }],
    });

    await beginBunkerQuest(client, 'event-1');
    await advanceBunkerPhase(client, 'event-1', 'dossier_2');
    await resetBunkerTeamStage(client, 'event-1', 'carriage-1', 'mission_a');
    await forceCompleteBunkerTeamStage(client, 'event-1', 'carriage-1', 'mission_a');
    await unlockBunker(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_begin_bunker_quest', { p_event_id: 'event-1' });
    expect(client.rpc).toHaveBeenCalledWith('owner_advance_bunker_phase', {
      p_event_id: 'event-1',
      p_phase: 'dossier_2',
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_reset_bunker_team_stage', {
      p_event_id: 'event-1',
      p_carriage_id: 'carriage-1',
      p_stage: 'mission_a',
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_force_complete_bunker_team_stage', {
      p_event_id: 'event-1',
      p_carriage_id: 'carriage-1',
      p_stage: 'mission_a',
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_unlock_bunker', { p_event_id: 'event-1' });
  });
});
