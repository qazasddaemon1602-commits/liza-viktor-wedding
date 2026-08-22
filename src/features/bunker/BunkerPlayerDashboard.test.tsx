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
  it('exposes all seven understandable game sections', () => {
    render(<BunkerPlayerDashboard runtime={runtime} />);
    const navigation = screen.getByRole('navigation', { name: 'Разделы игры' });
    for (const name of ['МОЙ ВАГОН','ПЕРСОНАЖ','ПАССАЖИРЫ','ИНВЕНТАРЬ','АРХИВ','СОСТОЯНИЕ','ТЕКУЩЕЕ ЗАДАНИЕ']) {
      expect(navigation).toContainElement(screen.getByRole('button', { name }));
    }
  });

  it('uses the real guest name and explains late registration', () => {
    render(<BunkerPlayerDashboard runtime={runtime} />);
    expect(screen.getByRole('heading', { name: 'СЕРГЕЙ П.' })).toBeInTheDocument();
    expect(screen.getByText(/после отправления/i)).toHaveTextContent(/продолжаете играть/i);
  });

  it('explains the character without leaking a hidden trait', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'ПЕРСОНАЖ' }));
    expect(screen.getByText('МЕХАНИК')).toBeInTheDocument();
    expect(screen.getByText(/Скрытая характеристика: пока скрыта/i)).toBeInTheDocument();
    expect(screen.getByText(/Открывает технический отсек без инструментов/i)).toBeInTheDocument();
  });

  it('localizes inventory instead of exposing raw item keys', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'ИНВЕНТАРЬ' }));
    expect(screen.getByRole('heading', { name: 'Рация' })).toBeInTheDocument();
    expect(screen.getByText('Доступно')).toBeInTheDocument();
    expect(screen.queryByText('radio')).not.toBeInTheDocument();
  });

  it.each([
    ['excluded', /персонаж исключён/i, /не выбываете/i],
    ['saved', /персонаж спасён/i, /продолжаете участвовать/i],
  ] as const)('keeps a %s character guest in the game', (status, statusCopy, continuationCopy) => {
    render(<BunkerPlayerDashboard runtime={{ ...runtime, character: { ...runtime.character, status } }} />);
    expect(screen.getByText(statusCopy)).toHaveTextContent(continuationCopy);
  });

  it('keeps a stale snapshot visible with an explicit connection notice', () => {
    render(<BunkerPlayerDashboard runtime={runtime} connectionError="Соединение потеряно." />);
    expect(screen.getByRole('alert')).toHaveTextContent(/соединение потеряно/i);
    expect(screen.getByRole('heading', { name: 'СЕРГЕЙ П.' })).toBeInTheDocument();
  });

  it('localizes legacy archive metadata and never needs an internal mission id', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={{
      ...runtime,
      archive: [
        { id: 'archive-1', artifactKey: 'archive-bk17', contentType: 'document', content: { protected: true }, decryptionStatus: 'partial', acquiredAt: '2026-08-20T18:00:00.000Z', decodedAt: null, scope: 'wagon' },
        { id: 'archive-2', artifactKey: 'access-card', contentType: 'card', content: {}, decryptionStatus: 'decoded', acquiredAt: '2026-08-20T18:01:00.000Z', decodedAt: null, scope: 'wagon' },
        { id: 'archive-3', artifactKey: 'sealed-document', contentType: 'document', content: {}, decryptionStatus: 'decoded', acquiredAt: '2026-08-20T18:02:00.000Z', decodedAt: null, scope: 'wagon' },
      ],
      currentMission: { id: 'mission-03', state: 'MISSION_03', plan: null },
      game: { ...runtime.game, state: 'MISSION_03' },
    }} />);

    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    const archive = within(screen.getByLabelText('Архив вагона'));
    expect(archive.getByRole('heading', { name: 'Папка BK-17' })).toBeInTheDocument();
    expect(archive.getByRole('heading', { name: 'Карта доступа' })).toBeInTheDocument();
    expect(archive.getByRole('heading', { name: 'Запечатанный документ' })).toBeInTheDocument();
    expect(archive.getAllByText('Документ')).toHaveLength(2);
    expect(archive.getByText('Расшифровано частично')).toBeInTheDocument();
    expect(archive.getAllByText('Материал вагона')).toHaveLength(3);
    expect(archive.getAllByTestId('bunker-archive-artwork')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' }));
    const mission = within(screen.getByLabelText('Текущее задание'));
    expect(mission.getByText(/Задание 3 — Аварийный запас/i)).toBeInTheDocument();
    expect(mission.queryByText('mission-03')).not.toBeInTheDocument();
    expect(mission.queryByText('MISSION_03')).not.toBeInTheDocument();
  });

  it('uses honest localized empty states', async () => {
    const user = userEvent.setup();
    render(<BunkerPlayerDashboard runtime={runtime} />);
    await user.click(screen.getByRole('button', { name: 'АРХИВ' }));
    expect(screen.getByText(/архив вагона пока пуст/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ТЕКУЩЕЕ ЗАДАНИЕ' }));
    expect(screen.getByText(/Персонажи розданы/i)).toBeInTheDocument();
    expect(screen.queryByText('CHARACTERS_READY')).not.toBeInTheDocument();
  });
});
