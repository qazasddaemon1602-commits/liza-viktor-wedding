import { describe, expect, it, vi } from 'vitest';
import {
  getGuestMissionTwoReadModel,
  submitMissionTwoAnswers,
  useMissionTwoAbility,
  type MissionTwoRpcClient,
} from './m02.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:10:00.000Z',
  instanceId: '52000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  deadlineAt: '2026-08-30T18:15:00.000Z',
  title: 'Чёрный ящик',
  subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ',
  intro: 'Чёрный ящик частично повреждён. Восстановлено шесть фрагментов записи. Только часть данных подлинна. Сопоставьте время, технические события и маршрут.',
  wagon: { number: 1, label: 'ВАГОН №1' },
  evidence: Array.from({ length: 6 }, (_, index) => ({
    key: `evidence_${String(index + 1).padStart(2, '0')}`,
    label: `Фрагмент ${String(index + 1).padStart(2, '0')}`,
    body: `Публичный фрагмент ${index + 1}`,
  })),
  questions: [
    { key: 'wagon', prompt: 'Из какого вагона пришёл аварийный сигнал?', options: ['Вагон №2', 'Вагон №3', 'Вагон №4'] },
    { key: 'event', prompt: 'Какое действие произошло непосредственно перед сбоем?', options: ['Открытие технического шлюза', 'Отключение освещения', 'Запуск резервного питания'] },
    { key: 'evidence', prompt: 'Какой номер фрагмента подтверждает вывод?', options: ['03', '05', '06'] },
  ],
  attemptCount: 0,
  attemptsRemaining: 2,
  selectedAnswers: ['', '', ''],
  ability: { available: true, key: 'terminal_hack', label: 'Работа со служебным терминалом', hint: 'Можно запросить один дополнительный технический фрагмент.' },
} as const;

describe('Mission 02 read model', () => {
  it('parses exactly six public evidence items without leaking the answer key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: active, error: null });
    const model = await getGuestMissionTwoReadModel({ rpc }, 'liza-viktor', 'device');

    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('expected active');
    expect(model.evidence).toHaveLength(6);
    expect(JSON.stringify(model)).not.toContain('answerKey');
    expect(JSON.stringify(model)).not.toContain('correctAnswers');
  });

  it('rejects malformed or answer-leaking payloads', async () => {
    const leaking = { ...active, answerKey: ['Вагон №4', 'Открытие технического шлюза', '05'] };
    await expect(getGuestMissionTwoReadModel({
      rpc: vi.fn().mockResolvedValue({ data: leaking, error: null }),
    }, 'liza-viktor', 'device')).rejects.toThrow(/mission two/i);
  });
});

describe('Mission 02 commands', () => {
  it('submits the three answers through the authoritative command transport only', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      contractVersion: 2,
      status: 'accepted',
      commandId: '52000000-0000-4000-8000-000000000020',
      commandType: 'submit_answer',
    }, error: null });
    const client: MissionTwoRpcClient = { rpc };

    await submitMissionTwoAnswers(client, {
      eventSlug: 'liza-viktor', deviceKey: 'device',
      commandId: '52000000-0000-4000-8000-000000000020',
      instanceId: active.instanceId,
      answers: ['Вагон №4', 'Открытие технического шлюза', '05'],
    });

    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', {
      p_event_slug: 'liza-viktor', p_device_key: 'device',
      p_command_id: '52000000-0000-4000-8000-000000000020',
      p_command_type: 'submit_answer',
      p_payload: { instanceId: active.instanceId, answers: ['Вагон №4', 'Открытие технического шлюза', '05'] },
    });
  });

  it('uses only the personal eligible M02 ability and the current instance', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      contractVersion: 2, status: 'accepted',
      commandId: '52000000-0000-4000-8000-000000000021', commandType: 'use_ability',
    }, error: null });

    await useMissionTwoAbility({ rpc }, {
      eventSlug: 'liza-viktor', deviceKey: 'device',
      commandId: '52000000-0000-4000-8000-000000000021',
      instanceId: active.instanceId, abilityKey: 'terminal_hack',
    });

    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'use_ability',
      p_payload: { instanceId: active.instanceId, problemKey: 'terminal_hack' },
    }));
  });
});
