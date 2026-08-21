import { describe, expect, it, vi } from 'vitest';
import { getGuestFinalReadModel, requestFinalAccess, type FinalRpcClient } from './final.service';

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
} as const;

describe('final guest contract', () => {
  it('parses only the caller wagon fragments and the shared terminal status', async () => {
    const model = await getGuestFinalReadModel({ rpc: vi.fn().mockResolvedValue({ data: active, error: null }) }, 'liza-viktor', 'device');
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.fragments).toEqual(active.fragments);
    expect(JSON.stringify(model)).not.toContain('LV0830');
    expect(JSON.stringify(model)).not.toContain('57°09 / 65°32');
  });

  it('submits the five terminal fields only through request_access', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'request_access' }, error: null });
    const client: FinalRpcClient = { rpc };
    await requestFinalAccess(client, { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'cmd', values: { coordinates: '57°09 / 65°32', sector: '04', accessCode: '4719', gateTime: '23:40', password: 'LV0830' } });
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({ p_command_type: 'request_access', p_payload: { coordinates: '57°09 / 65°32', sector: '04', accessCode: '4719', gateTime: '23:40', password: 'LV0830' } }));
  });
});
