import { describe, expect, it, vi } from 'vitest';
import {
  getGuestUnknownPassengerReadModel,
  getUnknownPassengerScreenReadModel,
  parseUnknownPassengerGuestReadModel,
} from './unknownPassenger.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T19:00:00.000Z',
  deadlineAt: '2026-08-30T19:01:00.000Z',
  title: 'Неизвестный пассажир',
  dossierId: 'BK-17',
  lead: 'В архиве найдено досье пассажира, которого нет в списке состава.',
  sector: '04',
  accessCode: '4719',
  bunkerRevealed: true,
  recoveredBy: 'common_protocol',
  storyPoints: [
    'BK-17 связан с закрытым объектом.',
    'Безопасная точка находится в секторе 04.',
    'Код доступа восстановлен и сохранён в архиве.',
  ],
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: active.serverNow,
  deadlineAt: active.deadlineAt,
  title: active.title,
  dossierId: active.dossierId,
  sector: active.sector,
} as const;

describe('Unknown Passenger service', () => {
  it('returns the story only when the authoritative story state is active', async () => {
    const model = await getGuestUnknownPassengerReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.dossierId).toBe('BK-17');
    expect(model.bunkerRevealed).toBe(true);
    expect(model.accessCode).toBe('4719');
  });

  it('rejects malformed bunker-revealed flags instead of coercing strings', () => {
    expect(() => parseUnknownPassengerGuestReadModel({ ...active, bunkerRevealed: 'false' }))
      .toThrow(/bunker revealed/i);
  });

  it('validates the TV/owner projection and keeps the access code out of it', async () => {
    const model = await getUnknownPassengerScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(model).toEqual(screenModel);
    expect(JSON.stringify(model)).not.toContain('4719');

    await expect(getUnknownPassengerScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: { ...screenModel, sector: '' }, error: null }) },
      'liza-viktor',
    )).rejects.toThrow(/sector/i);
  });

  it('accepts idle after the story state has advanced so the old scene cannot overlap final', async () => {
    const model = await getGuestUnknownPassengerReadModel(
      {
        rpc: vi.fn().mockResolvedValue({
          data: { contractVersion: 2, status: 'idle', serverNow: active.serverNow },
          error: null,
        }),
      },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('idle');
  });
});
