import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GuestBunkerGlobalMissionAction } from './bunkerRuntime.service';
import { BunkerMissionActions } from './BunkerMissionActions';

const noop = () => undefined;
const inventory = [
  { id: 'water-1', itemKey: 'water', quantity: 2, status: 'available' },
  { id: 'radio-1', itemKey: 'radio', quantity: 1, status: 'available' },
  { id: 'medkit-1', itemKey: 'medkit', quantity: 1, status: 'used' },
  { id: 'mask-1', itemKey: 'gas_mask', quantity: 1, status: 'lost' },
];

function action(
  missionState: GuestBunkerGlobalMissionAction['missionState'],
  requirements: Record<string, unknown>,
  completed = false,
): GuestBunkerGlobalMissionAction {
  return {
    missionState,
    requirements,
    completed,
    completedAt: completed ? '2026-08-30T18:10:00.000Z' : null,
    submittedPayload: completed ? { confirmed: true } : null,
  };
}

function renderGlobal(
  globalAction: GuestBunkerGlobalMissionAction,
  onGlobalMission = vi.fn(),
) {
  render(
    <BunkerMissionActions
      globalMissionState={globalAction.missionState}
      globalAction={globalAction}
      inventory={inventory}
      onGlobalMission={onGlobalMission}
      onMission={noop}
      onFinalCode={noop}
    />,
  );
  return { user: userEvent.setup(), onGlobalMission };
}

describe('global Bunker phone mission actions', () => {
  it('submits the exact M01 fictional profile quota and keeps real guests safe', async () => {
    const profiles = [
      { profileId: 'profile-1', guestId: 'guest-1', realName: 'Анна К.', profession: 'ВРАЧ', status: 'active' },
      { profileId: 'profile-2', guestId: 'guest-2', realName: 'Борис П.', profession: 'МЕХАНИК', status: 'active' },
      { profileId: 'profile-3', guestId: 'guest-3', realName: 'Вера С.', profession: 'АРХИВИСТ', status: 'active' },
    ];
    const { user, onGlobalMission } = renderGlobal(action('MISSION_01', {
      exclusionCount: 2,
      selectableProfiles: profiles,
    }));

    const region = screen.getByLabelText('Действие вагона');
    expect(within(region).getByText(/выберите ровно 2/i)).toBeInTheDocument();
    expect(within(region).getByText(/реальные гости остаются в игре/i)).toBeInTheDocument();
    const submit = within(region).getByRole('button', { name: 'ПОДТВЕРДИТЬ ВЫБОР' });
    expect(submit).toBeDisabled();
    await user.click(within(region).getByRole('checkbox', { name: /Анна К\. · ВРАЧ/i }));
    await user.click(within(region).getByRole('checkbox', { name: /Вера С\. · АРХИВИСТ/i }));
    await user.click(submit);
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_01', {
      selectedProfileIds: ['profile-1', 'profile-3'],
    });
    expect(region).not.toHaveTextContent('profile-1');
  });

  it('submits the M02 chronology as trimmed human text', async () => {
    const { user, onGlobalMission } = renderGlobal(action('MISSION_02', {
      minLength: 30,
      requiredTerms: ['bk-17', 'сектор', 'маршрут', 'тоннел', 'питан', 'канал 04'],
      fragments: ['21:47 · Скачок питания перед командой BK-17.'],
    }));
    expect(screen.getByText(/скачок питания перед командой BK-17/i)).toBeInTheDocument();
    const input = screen.getByLabelText('Хронология аварии');
    const submit = screen.getByRole('button', { name: 'ОТПРАВИТЬ ХРОНОЛОГИЮ' });
    await user.type(input, 'Сначала пропал свет, затем остановился поезд.');
    expect(submit).toBeDisabled();
    await user.clear(input);
    await user.type(input, '  Сначала пропало питание, затем остановился поезд.  ');
    await user.click(submit);
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_02', {
      chronology: 'Сначала пропало питание, затем остановился поезд.',
    });
  });

  it('offers M03 only available inventory keys and submits one to three exact keys', async () => {
    const { user, onGlobalMission } = renderGlobal(action('MISSION_03', {
      availableItemKeys: ['water', 'radio', 'medkit', 'gas_mask'],
      minItems: 1,
      maxItems: 3,
    }));
    const region = screen.getByLabelText('Действие вагона');
    expect(within(region).getByRole('checkbox', { name: /Запас воды/i })).toBeInTheDocument();
    expect(within(region).getByRole('checkbox', { name: /Рация/i })).toBeInTheDocument();
    expect(within(region).queryByRole('checkbox', { name: /Аптечка/i })).not.toBeInTheDocument();
    expect(within(region).queryByText('GAS_MASK')).not.toBeInTheDocument();
    await user.click(within(region).getByRole('checkbox', { name: /Запас воды/i }));
    await user.click(within(region).getByRole('checkbox', { name: /Рация/i }));
    await user.click(within(region).getByRole('button', { name: 'ПРИМЕНИТЬ ЗАПАС' }));
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_03', { itemKeys: ['water', 'radio'] });
  });

  it('shows five M03 risks and updates the chosen-item preview before submission', async () => {
    const onGlobalMission = vi.fn();
    const user = userEvent.setup();
    render(
      <BunkerMissionActions
        globalMissionState="MISSION_03"
        globalAction={action('MISSION_03', {
          availableItemKeys: ['water', 'medkit', 'generator', 'radio', 'tools'],
          minItems: 1,
          maxItems: 3,
        })}
        inventory={[
          { id: 'water-1', itemKey: 'water', quantity: 1, status: 'available' },
          { id: 'medkit-1', itemKey: 'medkit', quantity: 1, status: 'available' },
          { id: 'generator-1', itemKey: 'generator', quantity: 1, status: 'available' },
          { id: 'radio-1', itemKey: 'radio', quantity: 1, status: 'available' },
          { id: 'tools-1', itemKey: 'tools', quantity: 1, status: 'available' },
        ]}
        onGlobalMission={onGlobalMission}
        onMission={noop}
        onFinalCode={noop}
      />,
    );

    const region = screen.getByLabelText('Действие вагона');
    const risks = within(region).getByRole('list', { name: 'Риски вагона' });
    expect(within(risks).getAllByRole('listitem')).toHaveLength(5);
    expect(risks).toHaveTextContent(/вода и перегрев/i);
    expect(risks).toHaveTextContent(/медицинская помощь/i);
    expect(risks).toHaveTextContent(/резервное питание/i);
    expect(risks).toHaveTextContent(/связь с составом/i);
    expect(risks).toHaveTextContent(/механика и навигация/i);
    expect(within(risks).getAllByRole('img')).toHaveLength(5);
    expect(region).toHaveTextContent(/выбрано предметов: 0 из 3/i);
    expect(region).toHaveTextContent(/закрыто рисков: 0 из 5/i);
    expect(within(risks).getByRole('checkbox', { name: /запас воды/i })).toBeInTheDocument();

    await user.click(within(region).getByRole('checkbox', { name: /запас воды/i }));

    expect(region).toHaveTextContent(/выбрано предметов: 1 из 3/i);
    expect(region).toHaveTextContent(/закрыто рисков: 1 из 5/i);
    expect(region).toHaveTextContent(/запас воды закрывает риск «вода и перегрев»/i);
    expect(risks).toHaveTextContent(/выбран предмет: запас воды\. этот риск закрыт/i);
  });

  it('shows authoritative M03 ability closures without spending the matching inventory lots', () => {
    render(
      <BunkerMissionActions
        globalMissionState="MISSION_03"
        globalAction={action('MISSION_03', {
          availableItemKeys: ['water', 'medkit', 'generator', 'radio', 'tools'],
          minItems: 1,
          maxItems: 3,
        })}
        inventory={[
          { id: 'water-1', itemKey: 'water', quantity: 1, status: 'available' },
          { id: 'medkit-1', itemKey: 'medkit', quantity: 1, status: 'available' },
          { id: 'generator-1', itemKey: 'generator', quantity: 1, status: 'available' },
          { id: 'radio-1', itemKey: 'radio', quantity: 1, status: 'available' },
          { id: 'tools-1', itemKey: 'tools', quantity: 1, status: 'available' },
        ]}
        wagonState={{
          powerStatus: 'stable',
          waterStatus: 'stable',
          technicalDoorStatus: 'unlocked',
          abilityModifiers: {
            powerStabilized: true,
            waterStabilized: true,
            technicalDoorUnlocked: true,
            communicationBonus: 0,
          },
        }}
        onMission={noop}
        onFinalCode={noop}
      />,
    );

    const region = screen.getByLabelText('Действие вагона');
    const risks = within(region).getByRole('list', { name: 'Риски вагона' });
    for (const title of ['Вода и перегрев', 'Резервное питание', 'Механика и навигация']) {
      const card = within(risks).getByRole('heading', { name: title }).closest('li');
      expect(card).not.toBeNull();
      expect(card).toHaveTextContent('ЗАКРЫТО СПОСОБНОСТЬЮ');
      expect(within(card as HTMLElement).getByRole('checkbox')).toBeDisabled();
    }
    for (const title of ['Медицинская помощь', 'Связь с составом']) {
      const card = within(risks).getByRole('heading', { name: title }).closest('li');
      expect(card).not.toBeNull();
      expect(card).toHaveTextContent('РИСК ОСТАЁТСЯ');
    }
    expect(region).toHaveTextContent(/закрыто рисков: 3 из 5/i);
    expect(region).toHaveTextContent(/осталось рисков: 2 из 5/i);
  });

  it('keeps an unmapped available item separate from the closed-risk count', async () => {
    const user = userEvent.setup();
    render(
      <BunkerMissionActions
        globalMissionState="MISSION_03"
        globalAction={action('MISSION_03', {
          availableItemKeys: ['water', 'gas_mask'],
          minItems: 1,
          maxItems: 3,
        })}
        inventory={[
          { id: 'water-1', itemKey: 'water', quantity: 1, status: 'available' },
          { id: 'mask-1', itemKey: 'gas_mask', quantity: 1, status: 'available' },
        ]}
        onMission={noop}
        onFinalCode={noop}
      />,
    );

    const region = screen.getByLabelText('Действие вагона');
    const risks = within(region).getByRole('list', { name: 'Риски вагона' });
    const additionalItems = within(region).getByRole('group', { name: 'Дополнительные доступные предметы' });
    expect(within(risks).queryByRole('checkbox', { name: /противогаз/i })).not.toBeInTheDocument();
    await user.click(within(additionalItems).getByRole('checkbox', { name: /противогаз/i }));

    expect(region).toHaveTextContent(/выбрано предметов: 1 из 3/i);
    expect(region).toHaveTextContent(/закрыто рисков: 0 из 5/i);
    expect(region).toHaveTextContent(/противогаз пока не закрывает один из пяти рисков/i);
  });

  it('guides M04 through four steps and previews a real item transfer without raw IDs', async () => {
    const { user, onGlobalMission } = renderGlobal(action('MISSION_04', {
      groupWagons: [
        { id: 'wagon-id-2', number: 2, label: 'ВАГОН №2' },
        { id: 'wagon-id-5', number: 5, label: 'ВАГОН №5' },
      ],
      partnerWagons: [{ id: 'wagon-id-5', number: 5, label: 'ВАГОН №5' }],
      transferableItems: [
        { lotId: '00000000-0000-4000-8000-000000000941', itemKey: 'water', quantity: 2 },
        { lotId: '00000000-0000-4000-8000-000000000942', itemKey: 'radio', quantity: 1 },
        { lotId: '00000000-0000-4000-8000-000000000943', itemKey: 'radio', quantity: 4 },
      ],
      messageFragment: 'СЕКТОР 04 ПРИНИМАЕТ СОСТАВ',
      minLength: 15,
      requiredIncludes: ['04'],
      requiredTerms: ['тоннел', 'tunnel', 'маршрут', 'канал', 'сектор'],
    }));
    const region = screen.getByLabelText('Действие вагона');
    const steps = within(region).getByRole('list', { name: 'Порядок межвагонного обмена' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
    expect(steps).toHaveTextContent(/шаг 1.*найдите партнёрский вагон/i);
    expect(steps).toHaveTextContent(/шаг 2.*прочитайте свой фрагмент/i);
    expect(steps).toHaveTextContent(/шаг 3.*обменяйтесь данными и предметом/i);
    expect(steps).toHaveTextContent(/шаг 4.*проверьте и отправьте/i);
    expect(within(region).getByText(/ваша группа: вагон №2 · вагон №5/i)).toBeInTheDocument();
    expect(within(region).getByText(/связаться: вагон №5/i)).toBeInTheDocument();
    expect(within(region).getByText(/ваша часть сообщения/i)).toHaveTextContent(/сектор 04/i);
    expect(region).not.toHaveTextContent('wagon-id-5');
    const input = within(region).getByLabelText('Сообщение партнёрам');
    const submit = within(region).getByRole('button', { name: 'ОТПРАВИТЬ СООБЩЕНИЕ' });
    await user.type(input, 'Мы всё поняли и готовы');
    expect(submit).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'Сектор 04 найден');
    await user.selectOptions(
      within(region).getByLabelText('Предмет для передачи'),
      '00000000-0000-4000-8000-000000000943',
    );
    expect(submit).toBeDisabled();
    await user.selectOptions(within(region).getByLabelText('Кому передать предмет'), 'wagon-id-5');
    expect(within(region).getByRole('status', { name: 'Предварительная проверка обмена' }))
      .toHaveTextContent(/рация · 4 шт\. → вагон №5/i);
    await user.click(submit);
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_04', {
      message: 'Сектор 04 найден',
      partnerWagonIds: ['wagon-id-5'],
      transferLotId: '00000000-0000-4000-8000-000000000943',
      transferToWagonId: 'wagon-id-5',
    });
  });

  it('submits M05 route with an optional currently available item', async () => {
    const { user, onGlobalMission } = renderGlobal(action('MISSION_05', {
      routeChoices: ['safe', 'short'],
      availableItemKeys: ['radio', 'medkit'],
    }));
    await user.click(screen.getByRole('radio', { name: /безопасный маршрут/i }));
    await user.selectOptions(screen.getByLabelText('Предмет для маршрута'), 'radio');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ МАРШРУТ' }));
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_05', {
      routeChoice: 'safe',
      itemKey: 'radio',
    });
    expect(screen.queryByRole('option', { name: /Аптечка/i })).not.toBeInTheDocument();
  });

  it('confirms M06 after showing required wagons and the server fragment', async () => {
    const { user, onGlobalMission } = renderGlobal(action('MISSION_06', {
      requiredWagons: [
        { id: 'wagon-id-1', number: 1, label: 'ВАГОН №1' },
        { id: 'wagon-id-3', number: 3, label: 'ВАГОН №3' },
      ],
      rewardFragment: 'СЕКТОР 04',
      protocolFragments: ['ОБЪЕКТ · BK-17', 'АРХИВ · 4719'],
    }));
    const region = screen.getByLabelText('Действие вагона');
    expect(within(region).getByText(/вагоны протокола: вагон №1 · вагон №3/i)).toBeInTheDocument();
    expect(within(region).getByText(/СЕКТОР 04/)).toBeInTheDocument();
    expect(within(region).getByText(/ОБЪЕКТ · BK-17/)).toBeInTheDocument();
    await user.type(within(region).getByLabelText('Архивная последовательность'), '4719');
    await user.click(within(region).getByRole('checkbox', { name: /данные сверены/i }));
    await user.click(within(region).getByRole('button', { name: 'ПОДТВЕРДИТЬ ПРОТОКОЛ' }));
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_06', {
      protocolConfirmed: true,
      protocolCode: '4719',
    });
  });

  it('renders completed missions as read-only and does not expose consequences as controls', () => {
    renderGlobal(action('MISSION_05', {
      routeChoices: ['safe', 'short'], availableItemKeys: ['radio'],
    }, true));
    const region = screen.getByLabelText('Действие вагона');
    expect(within(region).getByRole('status')).toHaveTextContent(/решение вагона принято/i);
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    expect(within(region).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('opens the final code form from authoritative FINAL_30 even if the legacy phase is stale', async () => {
    const onFinalCode = vi.fn();
    const user = userEvent.setup();
    render(
      <BunkerMissionActions
        globalMissionState="FINAL_30"
        state={{
          status: 'active',
          phase: 'dossier_1',
          phaseStartedAt: '2026-08-30T18:00:00.000Z',
          startedAt: '2026-08-30T18:00:00.000Z',
          durationSeconds: 1800,
          remainingSeconds: 1800,
          serverNow: '2026-08-30T20:00:00.000Z',
          dossier: null,
          team: null,
          final: { unlocked: false },
        }}
        onMission={noop}
        onFinalCode={onFinalCode}
      />,
    );

    await user.type(screen.getByLabelText('Общий код Бункера'), '4719');
    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ШЛЮЗ' }));
    expect(onFinalCode).toHaveBeenCalledWith('4719');
  });
});
