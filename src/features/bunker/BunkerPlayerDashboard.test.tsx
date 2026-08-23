import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BunkerPlayerDashboard } from './BunkerPlayerDashboard';
import type { ActiveGuestBunkerRuntime } from './bunkerRuntime.service';

const runtime: ActiveGuestBunkerRuntime = {
  status: 'active', serverNow: '2026-08-20T18:00:00.000Z',
  game: { runNonce: 'run-1', state: 'CHARACTERS_READY', mode: 'production', finalStartedAt: null, finalDuration: 1800, bunkerRevealed: false },
  guest: { id: 'guest-1', realName: 'Сергей П.', joinedLate: true },
  wagon: { id: 'wagon-2', number: 2, label: 'Вагон №2' },
  character: {
    profession: 'МЕХАНИК', health: 'отличное', visibleSkill: 'ремонт механизмов',
    hiddenTrait: null, hiddenTraitRevealed: false, specialAbility: 'mechanical_fix',
    abilityDescription: 'Открывает технический отсек без инструментов.', abilityUsesRemaining: 1, status: 'active',
  },
  passengers: [{ guestId: 'guest-1', realName: 'Сергей П.', profession: 'МЕХАНИК', visibleSkill: 'ремонт механизмов', hiddenTrait: null, hiddenTraitRevealed: false, characterStatus: 'active' }],
  inventory: [{ id: 'item-1', itemKey: 'radio', quantity: 1, status: 'available', acquiredAt: '2026-08-20T18:00:00.000Z', usedAt: null, transferredTo: null }],
  archive: [],
  wagonState: { powerStatus: 'unstable', communicationStatus: 'working', navigationStatus: 'working', technicalDoorStatus: 'locked', trackDamage: 0, waterStatus: 'stable', routeChoice: null, routeBonus: 0, powerInstability: 0, sector04Found: false, coordinationBonus: false },
  currentMission: null,
  missionAction: null,
};

describe('BunkerPlayerDashboard', () => {
  it('persists the large-text preference and applies it to the dashboard', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('bunker.largeText.v1');

    const { unmount } = render(<BunkerPlayerDashboard runtime={runtime} />);
    const toggle = screen.getByRole('button', { name: 'КРУПНЫЙ ТЕКСТ' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Игровой модуль Бункер')).toHaveAttribute('data-large-text', 'true');
    expect(window.localStorage.getItem('bunker.largeText.v1')).toBe('true');

    unmount();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    expect(screen.getByRole('button', { name: 'КРУПНЫЙ ТЕКСТ' })).toHaveAttribute('aria-pressed', 'true');
    window.localStorage.removeItem('bunker.largeText.v1');
  });

  it('keeps an overflow section selected while the compact navigation menu closes', async () => {
    const user = userEvent.setup();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    try {
      render(<BunkerPlayerDashboard runtime={runtime} />);
      const overflow = screen.getByRole('group', { name: 'Дополнительные разделы' });
      await user.click(screen.getByRole('button', { name: 'ЕЩЁ' }));
      const archive = within(overflow).getByRole('button', { name: 'АРХИВ' });
      await user.click(archive);
      expect(archive).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { name: 'АРХИВ ВАГОНА' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'ЕЩЁ' }));
      expect(archive).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { name: 'АРХИВ ВАГОНА' })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    }
  });

  it('exposes all seven required archive sections as navigation targets', () => {
    render(<BunkerPlayerDashboard runtime={runtime} />);
    const relief = screen.getByTestId('bunker-tunnel-relief');
    expect(relief).toHaveAttribute('aria-hidden', 'true');
    expect(relief.querySelector('source[media="(max-width: 640px)"][type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/tunnel-relief-mobile-480.avif 480w, /images/bunker/tunnel-relief-mobile-960.avif 960w',
    );
    expect(relief.querySelector('source[type="image/avif"]:not([media])')).toHaveAttribute(
      'srcset',
      '/images/bunker/tunnel-relief-wide-960.avif 960w, /images/bunker/tunnel-relief-wide-1920.avif 1920w',
    );
    expect(relief.querySelector('img')).toHaveAttribute('src', '/images/bunker/tunnel-relief-wide.png');
    expect(relief.querySelector('img')).toHaveAttribute('alt', '');
    const navigation = screen.getByRole('navigation', { name: 'Разделы игры' });
    for (const name of [
      'МОЙ ВАГОН', 'ПЕРСОНАЖ', 'ПАССАЖИРЫ', 'ИНВЕНТАРЬ',
      'АРХИВ', 'СОСТОЯНИЕ', 'ТЕКУЩЕЕ ЗАДАНИЕ',
    ]) {
      expect(navigation).toContainElement(screen.getByRole('button', { name }));
    }
  });

  it('uses the real guest name and explains late registration', () => {
    render(<BunkerPlayerDashboard runtime={runtime} />);
    expect(screen.getByRole('heading', { name: 'СЕРГЕЙ П.' })).toBeInTheDocument();
    expect(screen.getByText(/после отправления/i)).toBeInTheDocument();
  });

  it('shows one memorable ability without exposing the hidden trait', async () => {
    const user = userEvent.setup();
    const runtimeWithOperationalCopy = {
      ...runtime,
      character: {
        ...runtime.character,
        abilityAction: {
          applicable: false,
          code: 'ability_not_applicable',
          missionState: 'CHARACTERS_READY',
          effectKind: null,
          effectLabel: 'РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ',
          effectDescription: 'Техническая дверь будет разблокирована. Эффект станет активен в задании 3.',
        },
      },
    } as unknown as ActiveGuestBunkerRuntime;
    render(<BunkerPlayerDashboard runtime={runtimeWithOperationalCopy} />);
    await user.click(screen.getByRole('button', { name: 'ПЕРСОНАЖ' }));
    expect(screen.getByText('МЕХАНИК')).toBeInTheDocument();
    expect(screen.getByText('ДАННЫЕ НЕДОСТУПНЫ')).toBeInTheDocument();
    expect(screen.getByText('РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ')).toBeInTheDocument();
    expect(screen.getByText(/эффект станет активен в задании 3/i)).toBeInTheDocument();
    expect(screen.queryByText('Открывает технический отсек без инструментов.')).not.toBeInTheDocument();
    expect(screen.queryByText(/легендар/i)).not.toBeInTheDocument();
  });

  it('explains and confirms an applicable ability inside the current mission', async () => {
    const user = userEvent.setup();
    const onAbility = vi.fn().mockResolvedValue({
      status: 'used',
      changed: true,
      idempotent: false,
      clientActionId: '00000000-0000-4000-8000-000000000951',
      missionState: 'MISSION_03',
      abilityKey: 'mechanical_fix',
      effectKind: 'technical_door_unlocked',
      effectLabel: 'РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ',
      effectDescription: 'Технический отсек будет разблокирован без расходования инструментов.',
      resultCopy: 'Механик разблокировал технический отсек вагона.',
      abilityUsesRemaining: 0,
    });
    const missionRuntime = {
      ...runtime,
      game: { ...runtime.game, state: 'MISSION_03' },
      currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
      character: {
        ...runtime.character,
        abilityAction: {
          applicable: true,
          code: 'ability_available',
          missionState: 'MISSION_03',
          effectKind: 'technical_door_unlocked',
          effectLabel: 'РАЗБЛОКИРОВКА ТЕХНИЧЕСКОЙ ДВЕРИ',
          effectDescription: 'Технический отсек будет разблокирован без расходования инструментов.',
        },
      },
    } as unknown as ActiveGuestBunkerRuntime;

    render(<BunkerPlayerDashboard runtime={missionRuntime} onAbility={onAbility} />);
    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));

    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByRole('heading', { name: 'ОСОБАЯ СПОСОБНОСТЬ' })).toBeInTheDocument();
    expect(mission.getByText(/отсек будет разблокирован/i)).toBeInTheDocument();
    await user.click(mission.getByRole('button', { name: 'ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ' }));
    expect(mission.getByText(/действие нельзя отменить/i)).toBeInTheDocument();
    await user.dblClick(mission.getByRole('button', { name: 'ПОДТВЕРДИТЬ ИСПОЛЬЗОВАНИЕ' }));

    expect(onAbility).toHaveBeenCalledTimes(1);
    expect(await mission.findByText(/механик разблокировал/i)).toBeInTheDocument();
    expect(mission.getByText(/осталось использований · 0/i)).toBeInTheDocument();
  });

  it('states clearly that abilities are unavailable during Mission 01', async () => {
    const user = userEvent.setup();
    const missionRuntime = {
      ...runtime,
      game: { ...runtime.game, state: 'MISSION_01' },
      currentMission: { id: 'mission_01', state: 'MISSION_01', plan: [] },
      character: {
        ...runtime.character,
        abilityAction: {
          applicable: false,
          code: 'ability_not_applicable',
          missionState: 'MISSION_01',
          effectKind: null,
          effectLabel: 'НЕДОСТУПНА В ЗАДАНИИ 1',
          effectDescription: 'В первом задании способности отключены: решение принимает весь вагон.',
        },
      },
    } as unknown as ActiveGuestBunkerRuntime;

    render(<BunkerPlayerDashboard runtime={missionRuntime} />);
    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));

    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByText(/в первом задании способности отключены/i)).toBeInTheDocument();
    expect(mission.queryByRole('button', { name: 'ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ' })).not.toBeInTheDocument();
  });

  it('opens inventory with explicit item status', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    expect(screen.getByRole('heading', { name: 'Рация' })).toBeInTheDocument();
    expect(screen.getByTestId('bunker-inventory-icon')).toHaveAttribute('src', '/images/bunker/items/radio.webp');
    expect(screen.getByTestId('bunker-inventory-icon')).toHaveAttribute('alt', 'Рация');
    expect(screen.getByText(/быстро сверить сообщение/i)).toBeInTheDocument();
    expect(screen.getByText('ДОСТУПНО')).toBeInTheDocument();
    expect(screen.queryByText('RADIO')).not.toBeInTheDocument();
  });

  it('never marks a used mission item as currently useful', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          game: { ...runtime.game, state: 'MISSION_03' },
          currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
          inventory: [{ id: 'item-2', itemKey: 'medkit', quantity: 1, status: 'used' }],
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    expect(screen.getByText('ИСПОЛЬЗОВАНО')).toBeInTheDocument();
    expect(screen.getByText('НЕДОСТУПНО ДЛЯ ПРИМЕНЕНИЯ')).toBeInTheDocument();
    expect(screen.queryByText('ПРИГОДИТСЯ В ТЕКУЩЕЙ МИССИИ')).not.toBeInTheDocument();
  });

  it('keeps an excluded character participant in the game', () => {
    render(
      <BunkerPlayerDashboard
        runtime={{ ...runtime, character: { ...runtime.character, status: 'excluded' } }}
      />,
    );

    expect(screen.getByText(/персонаж исключён/i)).toBeInTheDocument();
    expect(screen.getByText(/вы продолжаете участвовать/i)).toBeInTheDocument();
  });

  it('shows a saved character as a story result without ending guest participation', () => {
    render(
      <BunkerPlayerDashboard
        runtime={{ ...runtime, character: { ...runtime.character, status: 'saved' } }}
      />,
    );

    expect(screen.getByText(/персонаж спасён/i)).toBeInTheDocument();
    expect(screen.getByText(/вы продолжаете участвовать/i)).toBeInTheDocument();
  });

  it('wraps a long authoritative guest name and keeps one dominant mission action', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          guest: { ...runtime.guest, realName: 'Александра-Мария Константинопольская' },
          currentMission: { id: 'mission-03', state: 'MISSION_03', plan: null },
          game: { ...runtime.game, state: 'MISSION_03' },
        }}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'АЛЕКСАНДРА-МАРИЯ КОНСТАНТИНОПОЛЬСКАЯ' });
    expect(heading).toHaveClass('bunker-player-dashboard__guest-name');
    const action = screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' });
    expect(action).toHaveClass('bunker-player-dashboard__primary-action');
    expect(screen.getAllByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' })).toHaveLength(1);

    await user.click(action);
    expect(screen.getByRole('heading', { name: 'Аварийный запас' })).toBeInTheDocument();
  });

  it('explains the active mission instead of exposing internal runtime identifiers', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
          game: { ...runtime.game, state: 'MISSION_03' },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const mission = screen.getByLabelText('Текущее задание');
    expect(within(mission).getByRole('heading', { name: 'Аварийный запас' })).toBeInTheDocument();
    expect(within(mission).getByText(/пять проблем/i)).toBeInTheDocument();
    expect(within(mission).getByText(/нажмите на предмет/i)).toBeInTheDocument();
    expect(within(mission).queryByText('mission_03')).not.toBeInTheDocument();
    expect(within(mission).queryByText('MISSION_03')).not.toBeInTheDocument();
    expect(screen.queryByText('MISSION_03')).not.toBeInTheDocument();
  });

  it('lists only currently available matching items in the mission briefing', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          inventory: [
            ...runtime.inventory,
            { id: 'item-2', itemKey: 'medkit', quantity: 1, status: 'used' },
          ],
          currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
          game: { ...runtime.game, state: 'MISSION_03' },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const briefing = within(screen.getByLabelText('Описание текущего задания'));
    expect(briefing.getByText('Рация')).toBeInTheDocument();
    expect(briefing.queryByText('Аптечка')).not.toBeInTheDocument();
    expect(briefing.getByText(/доступно в вашем вагоне/i)).toBeInTheDocument();
    expect(briefing.queryByText(/капитан/i)).not.toBeInTheDocument();
    expect(briefing.getByText(/один участник вагона отправляет решение/i)).toBeInTheDocument();
  });

  it('shows the exact M01 wagon quota in briefing and hides consequences before completion', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          game: { ...runtime.game, state: 'MISSION_01' },
          currentMission: {
            id: 'mission_01',
            state: 'MISSION_01',
            plan: [{ wagonId: runtime.wagon.id, wagonSize: 8, exclusionCount: 2 }],
          },
          missionAction: {
            missionState: 'MISSION_01', completed: false, completedAt: null, submittedPayload: null,
            requirements: {
              exclusionCount: 2,
              selectableProfiles: [{
                profileId: 'profile-1', guestId: 'guest-1', realName: 'Сергей П.',
                profession: 'МЕХАНИК', status: 'active',
              }],
            },
          },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const briefing = within(screen.getByLabelText('Описание текущего задания'));
    expect(briefing.getByText(/квота вашего вагона: исключить 2 сюжетных персонажей/i)).toBeInTheDocument();
    expect(briefing.queryByRole('heading', { name: 'ЧТО ИЗМЕНИТСЯ' })).not.toBeInTheDocument();
  });

  it('uses the global M03 action instead of a simultaneous legacy mission', async () => {
    const user = userEvent.setup();
    const onGlobalMission = vi.fn();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          game: { ...runtime.game, state: 'MISSION_03' },
          currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
          missionAction: {
            missionState: 'MISSION_03', completed: false, completedAt: null, submittedPayload: null,
            requirements: { availableItemKeys: ['radio'], minItems: 1, maxItems: 3 },
          },
        }}
        questState={{
          status: 'active', phase: 'mission_a', phaseStartedAt: null,
          startedAt: runtime.serverNow, durationSeconds: 1800, remainingSeconds: 900,
          serverNow: runtime.serverNow, dossier: null,
          team: {
            carriageNumber: 2, stage: 'mission_a', completed: false, fragment: null,
            mission: { title: 'СТАРАЯ МИССИЯ', prompt: 'Не показывать', options: ['СТАРЫЙ ОТВЕТ'] },
          },
          final: { unlocked: false },
        }}
        onGlobalMission={onGlobalMission}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }));
    expect(screen.queryByText('СТАРАЯ МИССИЯ')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Рация/i }));
    await user.click(screen.getByRole('button', { name: 'ПРИМЕНИТЬ ЗАПАС' }));
    expect(onGlobalMission).toHaveBeenCalledWith('MISSION_03', { itemKeys: ['radio'] });
  });

  it('keeps a stale active snapshot visible with an explicit offline notice', () => {
    render(<BunkerPlayerDashboard runtime={runtime} connectionError="Соединение потеряно." />);
    expect(screen.getByRole('alert')).toHaveTextContent(/соединение потеряно/i);
    expect(screen.getByRole('heading', { name: 'СЕРГЕЙ П.' })).toBeInTheDocument();
  });

  it('renders authoritative archive metadata and a human mission briefing', async () => {
    const user = userEvent.setup();
    render(
      <BunkerPlayerDashboard
        runtime={{
          ...runtime,
          archive: [
            {
              id: 'archive-1', artifactKey: 'archive-bk17', contentType: 'document',
              content: { protected: true }, decryptionStatus: 'partial',
              acquiredAt: '2026-08-20T18:00:00.000Z', decodedAt: null, scope: 'wagon',
            },
            {
              id: 'archive-2', artifactKey: 'access-card', contentType: 'card',
              content: {}, decryptionStatus: 'decoded',
              acquiredAt: '2026-08-20T18:01:00.000Z', decodedAt: null, scope: 'wagon',
            },
            {
              id: 'archive-3', artifactKey: 'sealed-document', contentType: 'document',
              content: {}, decryptionStatus: 'decoded',
              acquiredAt: '2026-08-20T18:02:00.000Z', decodedAt: null, scope: 'wagon',
            },
          ],
          currentMission: { id: 'mission-03', state: 'MISSION_03', plan: null },
          game: { ...runtime.game, state: 'MISSION_03' },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    const archive = within(screen.getByLabelText('Архив вагона'));
    expect(archive.getByRole('heading', { name: 'ARCHIVE-BK17' })).toBeInTheDocument();
    expect(archive.getAllByText('DOCUMENT')).toHaveLength(2);
    expect(archive.getByText('PARTIAL')).toBeInTheDocument();
    expect(archive.getAllByText('WAGON')).toHaveLength(3);
    const archiveArtwork = archive.getAllByTestId('bunker-archive-artwork');
    expect(archiveArtwork).toHaveLength(3);
    expect(archiveArtwork.map((picture) => picture.querySelector('img')?.getAttribute('src'))).toEqual([
      '/images/bunker/archive-bk17.png',
      '/images/bunker/archive-card.png',
      '/images/bunker/archive-document.png',
    ]);
    expect(archiveArtwork.every((picture) => picture.querySelector('img')?.getAttribute('alt') === '')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByRole('heading', { name: 'Аварийный запас' })).toBeInTheDocument();
    expect(mission.queryByText('mission-03')).not.toBeInTheDocument();
    expect(mission.queryByText('MISSION_03')).not.toBeInTheDocument();
  });

  it('uses honest archive and mission empty states', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);

    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    expect(screen.getByText(/архив вагона пока пуст/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByText(/активное задание не назначено/i)).toBeInTheDocument();
    expect(mission.queryByText('CHARACTERS_READY')).not.toBeInTheDocument();
  });
});
