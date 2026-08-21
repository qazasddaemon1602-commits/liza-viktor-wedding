import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

const m02 = {
  contractVersion: 2 as const,
  status: 'active' as const,
  serverNow: '2026-08-30T18:10:00.000Z',
  instanceId: '52000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  deadlineAt: '2026-08-30T18:15:00.000Z',
  title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ', intro: 'Шесть фрагментов.',
  wagon: { number: 2, label: 'ВАГОН №2' },
  evidence: Array.from({ length: 6 }, (_, index) => ({ key: `e${index}`, label: `Фрагмент ${index + 1}`, body: `Данные ${index + 1}` })),
  questions: [
    { key: 'wagon', prompt: 'Вагон?', options: ['2','3','4'] },
    { key: 'event', prompt: 'Событие?', options: ['шлюз','свет','питание'] },
    { key: 'evidence', prompt: 'Фрагмент?', options: ['03','05','06'] },
  ],
  attemptCount: 0, attemptsRemaining: 2, selectedAnswers: ['', '', ''], ability: null,
};

function deps(overrides: Partial<GuestBunkerLiveDependencies>): GuestBunkerLiveDependencies {
  return {
    getDeviceKey: () => 'device',
    load: vi.fn().mockResolvedValue({ status: 'idle', serverNow: m02.serverNow }),
    loadRuntime: vi.fn().mockResolvedValue({ status: 'idle', serverNow: m02.serverNow }),
    submitMission: vi.fn(),
    submitFinalCode: vi.fn(),
    subscribeToRefresh: () => vi.fn(),
    ...overrides,
  } as GuestBunkerLiveDependencies;
}

describe('useGuestBunkerLiveState · M02', () => {
  it('loads the mission projection independently and derives the server timer', async () => {
    const dependencies = deps({ loadMissionTwo: vi.fn().mockResolvedValue(m02) });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionTwo).toMatchObject({
      title: 'Чёрный ящик', remainingSeconds: 300, connection: 'online',
    }));
  });

  it('submits answers, broadcasts refresh and reloads the M02 projection', async () => {
    const loadMissionTwo = vi.fn().mockResolvedValue(m02);
    const submitMissionTwo = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'submit_answer' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({ loadMissionTwo, submitMissionTwo, broadcastRefresh });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionTwo?.status).toBe('active'));

    await act(async () => result.current.submitMissionTwo(['4','шлюз','05']));

    expect(submitMissionTwo).toHaveBeenCalledWith('device', expect.objectContaining({
      instanceId: m02.instanceId,
      answers: ['4','шлюз','05'], commandId: expect.any(String),
    }));
    expect(broadcastRefresh).toHaveBeenCalled();
    expect(loadMissionTwo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
