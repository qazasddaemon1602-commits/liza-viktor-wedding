import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

const m03 = {
  contractVersion: 2 as const, status: 'active' as const,
  serverNow: '2026-08-30T18:20:00.000Z', deadlineAt: '2026-08-30T18:26:00.000Z',
  instanceId: '53000000-0000-4000-8000-000000000010', instanceVersion: 1,
  title: 'Аварийный запас', intro: 'Выберите приоритеты.', wagon: { number: 1, label: 'ВАГОН №1' }, memberRole: 'captain' as const,
  problems: [
    { key: 'injury', title: 'Ранен пассажир', risk: 'Риск', itemKey: 'medkit' },
    { key: 'communication', title: 'Пропадает связь', risk: 'Риск', itemKey: 'radio' },
    { key: 'power', title: 'Падает питание', risk: 'Риск', itemKey: 'generator' },
    { key: 'mechanism', title: 'Заклинило механизм', risk: 'Риск', itemKey: 'tools' },
    { key: 'water', title: 'Запас воды под угрозой', risk: 'Риск', itemKey: 'water' },
  ],
  inventory: [{ itemKey: 'medkit', quantity: 1, status: 'available' }], selectedProblems: [], ability: null, pendingCommitments: [],
};
const m04 = {
  contractVersion: 2 as const, status: 'active' as const,
  serverNow: '2026-08-30T18:30:00.000Z', deadlineAt: '2026-08-30T18:35:00.000Z',
  instanceId: '54000000-0000-4000-8000-000000000010', instanceVersion: 1,
  title: 'Межвагонная связь', interactionPhase: 'exchange' as const,
  group: { key: 'g1', wagons: [{ id: 'w1', number: 1, label: 'ВАГОН №1' }, { id: 'w2', number: 2, label: 'ВАГОН №2' }] },
  viewer: { wagonId: 'w1', wagonNumber: 1, isOperator: true }, messageQuota: 3, messagesRemaining: 3,
  messages: [], inventory: [{ itemKey: 'water', quantity: 2 }], trades: [], answer: { options: ['СВЯЗЬ','ПИТАНИЕ','МАРШРУТ'], selected: null, answeredWagons: 0, totalWagons: 2 }, ability: null,
};
function base(overrides: Partial<GuestBunkerLiveDependencies>): GuestBunkerLiveDependencies {
  return {
    getDeviceKey: () => 'device',
    load: vi.fn().mockResolvedValue({ status: 'idle', serverNow: m03.serverNow }),
    loadRuntime: vi.fn().mockResolvedValue({ status: 'idle', serverNow: m03.serverNow }),
    submitMission: vi.fn(), submitFinalCode: vi.fn(), subscribeToRefresh: () => vi.fn(), ...overrides,
  } as GuestBunkerLiveDependencies;
}

describe('useGuestBunkerLiveState M03/M04', () => {
  it('loads M03 and confirms captain allocation through the authoritative command', async () => {
    const loadMissionThree = vi.fn().mockResolvedValue(m03);
    const confirmMissionThree = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted' });
    const dependencies = base({ loadMissionThree, confirmMissionThree });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionThree).toMatchObject({ title: 'Аварийный запас', remainingSeconds: 360 }));
    await act(async () => result.current.confirmMissionThree(['injury','power']));
    expect(confirmMissionThree).toHaveBeenCalledWith('device', expect.objectContaining({ instanceId: m03.instanceId, instanceVersion: 1, selectedProblems: ['injury','power'], commandId: expect.any(String) }));
  });

  it('loads M04 and exposes message, trade and group answer commands', async () => {
    const loadMissionFour = vi.fn().mockResolvedValue(m04);
    const sendMissionFourMessage = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted' });
    const proposeMissionFourTrade = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted' });
    const respondMissionFourTrade = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted' });
    const submitMissionFourAnswer = vi.fn().mockResolvedValue({ contractVersion: 2, status: 'accepted' });
    const dependencies = base({ loadMissionFour, sendMissionFourMessage, proposeMissionFourTrade, respondMissionFourTrade, submitMissionFourAnswer });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionFour).toMatchObject({ title: 'Межвагонная связь', remainingSeconds: 300 }));
    await act(async () => result.current.sendMissionFourMessage('Связь есть'));
    await act(async () => result.current.proposeMissionFourTrade({ targetWagonNumber: 2, itemKey: 'water', quantity: 1 }));
    await act(async () => result.current.respondMissionFourTrade('transfer-1', 'accept'));
    await act(async () => result.current.submitMissionFourAnswer('СВЯЗЬ'));
    expect(sendMissionFourMessage).toHaveBeenCalled();
    expect(proposeMissionFourTrade).toHaveBeenCalled();
    expect(respondMissionFourTrade).toHaveBeenCalled();
    expect(submitMissionFourAnswer).toHaveBeenCalled();
  });
});
