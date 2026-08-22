import { describe, expect, it, vi } from 'vitest';
import {
  getFinalScreenReadModel,
  getGuestFinalReadModel,
  parseFinalGuestReadModel,
  requestFinalAccess,
  type FinalRpcClient,
} from './final.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T20:00:00.000Z',
  deadlineAt: '2026-08-30T20:30:00.000Z',
  title: '30 минут до Бункера',
  instanceId: '56000000-0000-4000-8000-000000000010',
  wagon: { number: 2, label: 'ВАГОН №2' },
  fragments: [
    { parameter: 'sector', label: 'Сектор', part: 1, totalParts: 1, value: '04' },
    { parameter: 'gate_time', label: 'Время открытия ворот', part: 1, totalParts: 1, value: '23:40' },
  ],
  terminal: { solved: 2, total: 5, wrongAttempts: 1, unlocked: false },
  hint: { level: 0, text: '' },
  timeAdjustmentSeconds: 240,
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: active.serverNow,
  deadlineAt: active.deadlineAt,
  solved: 2,
  total: 5,
  wrongAttempts: 1,
  unlocked: false,
  hintLevel: 1,
  timeAdjustmentSeconds: 240,
} as const;

describe('final guest contract', () => {
  it('parses only the caller wagon fragments and the shared terminal status', async () => {
    const model = await getGuestFinalReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.fragments).toEqual(active.fragments);
    expect(model.timeAdjustmentSeconds).toBe(240);
    expect(JSON.stringify(model)).not.toContain('LV0830');
    expect(JSON.stringify(model)).not.toContain('57°09 / 65°32');
  });

  it('rejects truthy strings instead of silently coercing terminal booleans', () => {
    expect(() => parseFinalGuestReadModel({
      ...active,
      terminal: { ...active.terminal, unlocked: 'false' },
    })).toThrow(/unlocked/i);
  });

  it('rejects malformed hint and terminal counters', () => {
    expect(() => parseFinalGuestReadModel({
      ...active,
      terminal: { ...active.terminal, solved: -1 },
    })).toThrow(/solved/i);
    expect(() => parseFinalGuestReadModel({
      ...active,
      hint: { level: 4, text: 'x' },
    })).toThrow(/hint/i);
  });

  it('validates the public TV and owner final projection at runtime', async () => {
    const model = await getFinalScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(model).toEqual(screenModel);

    await expect(getFinalScreenReadModel(
      {
        rpc: vi.fn().mockResolvedValue({
          data: { ...screenModel, unlocked: 'false' },
          error: null,
        }),
      },
      'liza-viktor',
    )).rejects.toThrow(/unlocked/i);
  });

  it('submits the five terminal fields only through request_access', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'request_access' },
      error: null,
    });
    const client: FinalRpcClient = { rpc };
    await requestFinalAccess(client, {
      eventSlug: 'liza-viktor',
      deviceKey: 'device',
      commandId: 'cmd',
      values: {
        coordinates: '57°09 / 65°32',
        sector: '04',
        accessCode: '4719',
        gateTime: '23:40',
        password: 'LV0830',
      },
    });
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'request_access',
      p_payload: {
        coordinates: '57°09 / 65°32', sector: '04', accessCode: '4719',
        gateTime: '23:40', password: 'LV0830',
      },
    }));
  });
});
