// @ts-expect-error Vitest runs this style contract in Node; the browser bundle intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BunkerResultsScreen } from './BunkerResultsScreen';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };

const model = {
  finishTimeSeconds: 742,
  emergencyOpen: false,
  characters: { active: 1, saved: 16, excluded: 3 },
  archiveFound: 4,
  resourcesRemaining: 7,
  resourcesUsed: 5,
  tradesCompleted: 2,
  wrongAttempts: 1,
  hintsUsed: 1,
  skillsUsed: 4,
  missionsCompleted: 6,
  missionsTotal: 6,
  coordinationScore: 91,
};

describe('BunkerResultsScreen', () => {
  it('turns the end of the game into a clear celebration instead of an internal state', () => {
    render(<BunkerResultsScreen model={model} />);
    expect(screen.getByRole('region', { name: 'Бункер открыт · итоги игры' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'БУНКЕР ОТКРЫТ' })).toBeInTheDocument();
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.getByText(/12:22/)).toBeInTheDocument();
    expect(screen.getByText(/16 персонажей спасено/i)).toBeInTheDocument();
    expect(screen.getByText(/3 исключено · 1 осталось активно/i)).toBeInTheDocument();
    expect(screen.getByText(/4 материалов найдено/i)).toBeInTheDocument();
    expect(screen.getByText(/7 осталось/i)).toBeInTheDocument();
    expect(screen.getByText(/5 использовано по пути/i)).toBeInTheDocument();
    expect(screen.getByText(/2 обменов/i)).toBeInTheDocument();
    expect(screen.getByText(/4 особых способностей использовано/i)).toBeInTheDocument();
    expect(screen.getByText(/6 \/ 6 этапов завершено/i)).toBeInTheDocument();
    expect(screen.getByText(/1 неверных проверок/i)).toBeInTheDocument();
    expect(screen.getByText(/1 уровней подсказок использовано/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Эпилог Лизы и Виктора')).toHaveTextContent('Поезд Виктора прибыл к Лизе. Теперь маршрут продолжается вместе.');
    expect(screen.getByRole('img', { name: 'Лиза и Виктор вместе после прибытия поезда' })).toHaveAttribute('width', '1536');
    expect(screen.getByRole('img', { name: 'Лиза и Виктор вместе после прибытия поезда' })).toHaveAttribute('height', '1024');
    fireEvent.error(screen.getByRole('img', { name: 'Лиза и Виктор вместе после прибытия поезда' }));
    expect(screen.queryByRole('img', { name: 'Лиза и Виктор вместе после прибытия поезда' })).not.toBeInTheDocument();
    expect(screen.getByText('91 / 100')).toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('LV0830')).not.toBeInTheDocument();
    expect(screen.getByText(/ПОЕЗД ПРИБЫЛ · ВСЕ ГОСТИ ОСТАЮТСЯ В ИГРЕ/)).toBeInTheDocument();
  });

  it('uses a viewport-bounded two-column projector contract while leaving mobile scrollable', () => {
    const css = [
      readFileSync(`${testRuntime.process.cwd()}/src/styles/bunker-accessibility.css`, 'utf8'),
      readFileSync(`${testRuntime.process.cwd()}/src/styles/bunker-quest.css`, 'utf8'),
    ].join('\n');
    const desktop = css.match(/@media \(min-width: 761px\)[\s\S]*?@media \(max-width: 760px\)/)?.[0] ?? '';
    expect(desktop).toMatch(/\.bunker-v2-results\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/);
    expect(desktop).toMatch(/\.bunker-v2-results__body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(/);
    expect(desktop).toMatch(/\.bunker-results-epilogue\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*1\s*\/\s*-1/);
    const mobile = css.match(/@media \(max-width: 760px\)[\s\S]*/)?.[0] ?? '';
    expect(mobile).toMatch(/\.bunker-v2-results\s*\{[^}]*height:\s*auto[^}]*overflow-y:\s*auto/);
  });
});
