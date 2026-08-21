import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
};

describe('BunkerPlayerDashboard', () => {
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
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'ПЕРСОНАЖ' }));
    expect(screen.getByText('МЕХАНИК')).toBeInTheDocument();
    expect(screen.getByText('ДАННЫЕ НЕДОСТУПНЫ')).toBeInTheDocument();
    expect(screen.getByText('Открывает технический отсек без инструментов.')).toBeInTheDocument();
    expect(screen.queryByText(/легендар/i)).not.toBeInTheDocument();
  });

  it('opens inventory with explicit item status', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    expect(screen.getByText('RADIO')).toBeInTheDocument();
    expect(screen.getByText('ДОСТУПНО')).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' })).toBeInTheDocument();
  });

  it('keeps a stale active snapshot visible with an explicit offline notice', () => {
    render(<BunkerPlayerDashboard runtime={runtime} connectionError="Соединение потеряно." />);
    expect(screen.getByRole('alert')).toHaveTextContent(/соединение потеряно/i);
    expect(screen.getByRole('heading', { name: 'СЕРГЕЙ П.' })).toBeInTheDocument();
  });

  it('renders authoritative archive metadata and current mission identity', async () => {
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
    expect(mission.getByText('mission-03')).toBeInTheDocument();
    expect(mission.getByText('MISSION_03')).toBeInTheDocument();
  });

  it('uses honest archive and mission empty states', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);

    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    expect(screen.getByText(/архив вагона пока пуст/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByText(/активное задание не назначено/i)).toBeInTheDocument();
    expect(mission.getByText('CHARACTERS_READY')).toBeInTheDocument();
  });
});
