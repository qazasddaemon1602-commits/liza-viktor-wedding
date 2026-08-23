import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BunkerHostRunbook } from './BunkerHostRunbook';

describe('BunkerHostRunbook', () => {
  it('gives the host a complete timeline and actionable script for the current mission', () => {
    render(<BunkerHostRunbook mission="MISSION_03" plan={null} />);

    const runbook = screen.getByRole('region', { name: 'Сценарий ведущего Бункера' });
    const timeline = within(runbook).getByRole('list', { name: 'Таймлайн Бункера' });
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(13);
    expect(within(timeline).getByText('Аварийный запас').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(within(runbook).getByRole('heading', { name: 'СЕЙЧАС ПРОЧИТАТЬ' })).toBeInTheDocument();
    expect(within(runbook).getByText(/закрыть все проблемы нельзя/i)).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'МОЖНО ИМПРОВИЗИРОВАТЬ' })).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'ЕСЛИ КОМАНДЫ ЗАСТРЯЛИ' })).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'НЕ РАСКРЫВАТЬ РАНЬШЕ' })).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'ПОСЛЕ ЗАВЕРШЕНИЯ' })).toBeInTheDocument();
  });

  it.each([
    ['LOBBY', 'Пролог'],
    ['CHARACTERS_READY', 'Пролог'],
    ['BREAK', 'Архивная пауза'],
    ['STORY_BUNKER', 'История Бункера'],
    ['BREAK_BEFORE_FINAL', 'Перед финалом'],
    ['BUNKER_OPEN', 'Бункер открыт'],
    ['FINISHED', 'Эпилог'],
  ])('keeps a usable host script during non-mission runtime stage %s', (stage, title) => {
    render(<BunkerHostRunbook mission={stage} plan={null} />);

    const runbook = screen.getByRole('region', { name: 'Сценарий ведущего Бункера' });
    expect(within(runbook).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'СЕЙЧАС ПРОЧИТАТЬ' })).toBeInTheDocument();
    expect(within(runbook).queryByText(/сценарий текущей миссии появится/i)).not.toBeInTheDocument();
  });

  it('uses the authoritative M01 exclusion counts instead of a fixed number', () => {
    render(
      <BunkerHostRunbook
        mission="MISSION_01"
        plan={[
          { wagonId: 'wagon-1', wagonSize: 6, exclusionCount: 1 },
          { wagonId: 'wagon-2', wagonSize: 11, exclusionCount: 3 },
        ]}
      />,
    );

    const plan = screen.getByRole('article', { name: 'План текущего задания' });
    expect(plan).toHaveTextContent('Вагон 1 — исключить 1 персонажа');
    expect(plan).toHaveTextContent('Вагон 2 — исключить 3 персонажей');
  });

  it('uses temporary wagon representatives without inventing a captain role', () => {
    render(<BunkerHostRunbook mission="LOBBY" plan={null} />);
    const runbook = screen.getByRole('region', { name: 'Сценарий ведущего Бункера' });
    expect(runbook).not.toHaveTextContent(/капитан/i);
    expect(runbook).toHaveTextContent(/один участник|связн/i);
  });

  it('explains the authoritative M04 pair and triple grouping', () => {
    render(
      <BunkerHostRunbook
        mission="MISSION_04"
        plan={{ groups: [['wagon-1', 'wagon-2'], ['wagon-3', 'wagon-4', 'wagon-5']] }}
      />,
    );

    const plan = screen.getByRole('article', { name: 'План текущего задания' });
    expect(plan).toHaveTextContent('Группа 1 · пара');
    expect(plan).toHaveTextContent('Группа 2 · тройка');
  });

  it('describes dynamic final fragments without telling the host to accept story clue 4719', () => {
    render(
      <BunkerHostRunbook
        mission="FINAL_30"
        plan={[
          { wagonId: 'wagon-1', parameter: 'coordinates', part: 1, totalParts: 2 },
          { wagonId: 'wagon-2', parameter: 'sector', part: 1, totalParts: 1 },
          { wagonId: 'wagon-3', parameter: 'code', part: 1, totalParts: 2 },
          { wagonId: 'wagon-4', parameter: 'gateway_time', part: 1, totalParts: 1 },
          { wagonId: 'wagon-5', parameter: 'password', part: 1, totalParts: 1 },
          { wagonId: 'wagon-1', parameter: 'coordinates', part: 2, totalParts: 2 },
          { wagonId: 'wagon-2', parameter: 'code', part: 2, totalParts: 2 },
        ]}
      />,
    );

    const runbook = screen.getByRole('region', { name: 'Сценарий ведущего Бункера' });
    const plan = within(runbook).getByRole('article', { name: 'План текущего задания' });
    expect(plan).toHaveTextContent('7 фрагментов');
    expect(plan).toHaveTextContent('Код доступа · часть 1 из 2');
    expect(runbook).not.toHaveTextContent('4719');
    expect(runbook).toHaveTextContent(/система подтвердила/i);
  });

  it('briefs the host on Viktor driving to BK-17 while the waiting source stays anonymous', () => {
    render(<BunkerHostRunbook mission="LOBBY" plan={null} />);
    const prologue = screen.getByRole('region', { name: 'Сценарий ведущего Бункера' });
    expect(prologue).toHaveTextContent(/Виктор ведёт поезд.*BK-17/i);
    expect(prologue).toHaveTextContent(/неизвестн.*источник.*ждёт.*BK-17/i);
    expect(prologue).not.toHaveTextContent(/Лиза/i);

    render(<BunkerHostRunbook mission="FINAL_30" plan={null} />);
    const runbooks = screen.getAllByRole('region', { name: 'Сценарий ведущего Бункера' });
    const finalRunbook = runbooks[1];
    expect(finalRunbook).toHaveTextContent(/довести поезд Виктора до BK-17/i);
    expect(finalRunbook).not.toHaveTextContent(/Лиза/i);
  });
});
