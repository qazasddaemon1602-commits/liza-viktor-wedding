import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from './GuestJoinPage';

const restoredGuest = {
  id: 'guest-31',
  firstName: 'Иван',
  lastName: 'Петров',
  affiliationType: 'viktor',
  affiliationDetail: '',
  ticketNumber: 'LV-031',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#7E3F3C',
    visualMark: '03',
  },
};

describe('GuestJoinPage', () => {
  it('loads the authoritative Bunker runtime through production dependencies and opens the active dashboard', async () => {
    const user = userEvent.setup();
    const registrationRpc = vi.fn(async (name: string) => {
      if (name === 'restore_guest') {
        return { data: { status: 'restored', guest: restoredGuest }, error: null };
      }
      if (name === 'get_guest_active_carriage_calls') {
        return { data: { status: 'ok', carriage: restoredGuest.carriage, calls: [] }, error: null };
      }
      return { data: null, error: new Error(`Unexpected registration RPC ${name}`) };
    });
    const activeRuntime = {
      status: 'active', serverNow: '2026-08-20T18:00:00.000Z',
      game: { runNonce: 'run-1', state: 'MISSION_03', mode: 'production', finalStartedAt: null, finalDuration: 1800, bunkerRevealed: false },
      guest: { id: restoredGuest.id, realName: 'Иван П.', joinedLate: false },
      wagon: { id: restoredGuest.carriage.id, number: 3, label: 'ВАГОН №3' },
      character: {
        profession: 'МЕХАНИК', health: 'отличное', visibleSkill: 'ремонт механизмов',
        hiddenTrait: null, hiddenTraitRevealed: false, specialAbility: 'mechanical_fix',
        abilityDescription: 'Открывает технический отсек.', abilityUsesRemaining: 1, status: 'active',
        abilityAction: {
          applicable: true,
          code: 'ability_available',
          missionState: 'MISSION_03',
          effectKind: 'technical_door_unlocked',
          effectLabel: 'РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ',
          effectDescription: 'Технический отсек будет разблокирован без расходования инструментов.',
        },
      },
      passengers: [], inventory: [], archive: [],
      wagonState: { powerStatus: 'stable', communicationStatus: 'working', navigationStatus: 'working' },
      currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
    };
    const bunkerRpc = vi.fn(async (name: string) => {
      if (name === 'get_guest_bunker_state') {
        return { data: { status: 'idle', serverNow: '2026-08-20T18:00:00.000Z' }, error: null };
      }
      if (name === 'get_guest_bunker_runtime') {
        return { data: activeRuntime, error: null };
      }
      if (name === 'use_guest_bunker_ability') {
        return {
          data: {
            status: 'used', changed: true, idempotent: false,
            clientActionId: '00000000-0000-4000-8000-000000000951',
            missionState: 'MISSION_03', abilityKey: 'mechanical_fix',
            effectKind: 'technical_door_unlocked',
            effectLabel: 'РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ',
            effectDescription: 'Технический отсек будет разблокирован без расходования инструментов.',
            resultCopy: 'Механик разблокировал технический отсек вагона.',
            abilityUsesRemaining: 0,
          },
          error: null,
        };
      }
      return { data: null, error: new Error(`Unexpected Bunker RPC ${name}`) };
    });

    render(
      <GuestJoinPage
        client={{ rpc: registrationRpc }}
        bunkerClient={{ rpc: bunkerRpc }}
        eventSlug="liza-viktor"
        deviceKey="lvw_device_31"
        revealDelayMs={0}
      />,
    );

    expect(await screen.findByLabelText('Игровой модуль Бункер')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ИВАН П.' })).toBeInTheDocument();
    expect(bunkerRpc).toHaveBeenCalledWith('get_guest_bunker_runtime', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_31',
    });

    const guidedMission = screen.getByRole('main', { name: 'Текущее задание' });
    await user.click(within(guidedMission).getByRole('button', { name: 'ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ' }));
    await user.click(within(guidedMission).getByRole('button', { name: 'ПОДТВЕРДИТЬ ИСПОЛЬЗОВАНИЕ' }));
    expect(await screen.findAllByText(/механик разблокировал/i)).toHaveLength(2);
    expect(bunkerRpc).toHaveBeenCalledWith('use_guest_bunker_ability', expect.objectContaining({
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_31',
      p_client_action_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }));
  });

  it('restores the existing ticket before showing a new registration form', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'restored', guest: restoredGuest },
      error: null,
    });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0} />);

    expect(screen.getByText(/проверяем билет/i)).toBeInTheDocument();
    expect(await screen.findByTestId('virtual-ticket')).toHaveTextContent('LV-031');
    expect(screen.queryByRole('button', { name: /получить билет/i })).not.toBeInTheDocument();
  });

  it('shows registration when the device has no existing binding', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'not_found' }, error: null });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_new_device" revealDelayMs={0} />);

    expect(await screen.findByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('restore_guest', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_new_device',
    });
  });

  it('shows a recoverable error instead of an empty page when restore fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('offline') });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0} />);

    expect(await screen.findByText(/не удалось проверить билет/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /попробовать снова/i })).toBeInTheDocument();
  });

  it('loads the active call for the restored guest carriage', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'restore_guest') {
        return { data: { status: 'restored', guest: restoredGuest }, error: null };
      }
      if (name === 'get_guest_active_carriage_calls') {
        return {
          data: {
            status: 'ok',
            carriage: restoredGuest.carriage,
            calls: [{
              id: 'call-3',
              message: 'ВАГОН 3 — ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР',
              showOnScreen: false,
              createdAt: '2026-08-30T13:00:00+05:00',
            }],
          },
          error: null,
        };
      }
      return { data: null, error: new Error(`Unexpected RPC ${name}`) };
    });

    render(<GuestJoinPage client={{ rpc }} eventSlug="liza-viktor" deviceKey="lvw_device_31" revealDelayMs={0} />);

    expect(await screen.findByText('ВАГОН 3 — ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР')).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('get_guest_active_carriage_calls', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_31',
    });
  });

  it('refreshes the guest banner from the backend when its carriage receives a realtime signal', async () => {
    let callReads = 0;
    const rpc = vi.fn(async (name: string) => {
      if (name === 'restore_guest') {
        return { data: { status: 'restored', guest: restoredGuest }, error: null };
      }
      if (name === 'get_guest_active_carriage_calls') {
        callReads += 1;
        return {
          data: {
            status: 'ok',
            carriage: restoredGuest.carriage,
            calls: callReads === 1 ? [{
              id: 'call-3',
              message: 'ВАГОН 3 — НА БАР',
              showOnScreen: false,
              createdAt: '2026-08-30T13:00:00+05:00',
            }] : [],
          },
          error: null,
        };
      }
      return { data: null, error: new Error(`Unexpected RPC ${name}`) };
    });

    let refreshHandler: (() => void) | undefined;
    const unsubscribe = vi.fn();
    const channel = {
      on: vi.fn((_type: 'broadcast', _filter: { event: 'refresh' }, callback: () => void) => {
        refreshHandler = callback;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe,
      send: vi.fn().mockResolvedValue('ok'),
    };
    const realtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
    };

    render(
      <GuestJoinPage
        client={{ rpc }}
        realtimeClient={realtimeClient}
        eventSlug="liza-viktor"
        deviceKey="lvw_device_31"
        revealDelayMs={0}
      />,
    );

    expect(await screen.findByText('ВАГОН 3 — НА БАР')).toBeInTheDocument();
    expect(realtimeClient.channel).toHaveBeenCalledWith('carriage-call:carriage-3');

    await act(async () => {
      refreshHandler?.();
      await Promise.resolve();
    });

    expect(screen.queryByText('ВАГОН 3 — НА БАР')).not.toBeInTheDocument();
    expect(callReads).toBe(2);
  });
});
