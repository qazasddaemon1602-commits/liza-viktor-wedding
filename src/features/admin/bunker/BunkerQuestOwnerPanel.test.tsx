import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnerBunkerQuestState } from '../../bunker/bunkerQuest.types';
import { BunkerQuestOwnerPanel } from './BunkerQuestOwnerPanel';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
let stylesheet: HTMLStyleElement | null = null;

afterEach(() => {
  stylesheet?.remove();
  stylesheet = null;
});

const state: Extract<OwnerBunkerQuestState, { status: 'active' }> = {
  status: 'active',
  phase: 'mission_a',
  phaseStartedAt: '2026-08-30T18:05:00.000Z',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1500,
  soundEnabled: true,
  unlocked: false,
  serverNow: '2026-08-30T18:05:00.000Z',
  teams: Array.from({ length: 5 }, (_, index) => ({
    carriageId: `carriage-${index + 1}`,
    carriageNumber: index + 1,
    label: `ВАГОН №${index + 1}`,
    missionA: { completed: index < 4, attemptCount: index + 1, hint: `Подсказка A${index + 1}` },
    missionB: { completed: false, attemptCount: 0, fragment: null, hint: `Подсказка B${index + 1}` },
  })),
};

describe('BunkerQuestOwnerPanel', () => {
  it('shows all five carriage progress cards and keeps phase progression manual', () => {
    render(
      <BunkerQuestOwnerPanel
        state={state}
        onBegin={vi.fn()}
        onAdvance={vi.fn()}
        onReset={vi.fn()}
        onForce={vi.fn()}
        onUnlock={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/ВАГОН №/)).toHaveLength(5);
    expect(screen.getByText('4 / 5 ГОТОВО')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ОТКРЫТЬ ЗАДАНИЕ B' })).toBeDisabled();
  });

  it('requires explicit confirmation for owner force-complete/reset fallbacks per carriage', async () => {
    const user = userEvent.setup();
    const onForce = vi.fn();
    const onReset = vi.fn();
    render(
      <BunkerQuestOwnerPanel
        state={state}
        onBegin={vi.fn()}
        onAdvance={vi.fn()}
        onReset={onReset}
        onForce={onForce}
        onUnlock={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ЗАВЕРШИТЬ ВРУЧНУЮ · ВАГОН №5' }));
    expect(onForce).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ РУЧНОЕ ЗАВЕРШЕНИЕ' }));
    expect(onForce).toHaveBeenCalledWith('carriage-5', 'mission_a');

    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ · ВАГОН №1' }));
    expect(onReset).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ СБРОС' }));
    expect(onReset).toHaveBeenCalledWith('carriage-1', 'mission_a');
  });

  it('requires danger-zone confirmation before the manual unlock fallback', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(
      <BunkerQuestOwnerPanel
        state={{ ...state, phase: 'final', teams: state.teams.map((team) => ({
          ...team,
          missionA: { ...team.missionA, completed: true },
          missionB: { ...team.missionB, completed: true, fragment: '42' },
        })) }}
        onBegin={vi.fn()}
        onAdvance={vi.fn()}
        onReset={vi.fn()}
        onForce={vi.fn()}
        onUnlock={onUnlock}
      />,
    );

    expect(screen.getAllByText('42')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ БУНКЕР ВРУЧНУЮ' }));
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('ОТКРЫТЬ БУНКЕР ВРУЧНУЮ?');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ РУЧНОЕ ОТКРЫТИЕ' }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('gives stage and fallback controls a real primary hierarchy and mobile-safe sizing', () => {
    stylesheet = document.createElement('style');
    stylesheet.textContent = [
      readFileSync(`${testRuntime.process.cwd()}/src/styles/bunker-quest.css`, 'utf8'),
      readFileSync(`${testRuntime.process.cwd()}/src/styles/admin-bunker.css`, 'utf8'),
      readFileSync(`${testRuntime.process.cwd()}/src/styles/mobile-hardening.css`, 'utf8'),
    ].join('\n');
    document.head.append(stylesheet);

    render(
      <BunkerQuestOwnerPanel
        state={state}
        onBegin={vi.fn()}
        onAdvance={vi.fn()}
        onReset={vi.fn()}
        onForce={vi.fn()}
        onUnlock={vi.fn()}
      />,
    );

    const primary = screen.getByRole('button', { name: 'ОТКРЫТЬ ЗАДАНИЕ B' });
    const fallback = screen.getByRole('button', { name: 'СБРОСИТЬ · ВАГОН №1' });
    const operationalCopy = screen.getByText(/Переход остаётся под контролем ведущего/);

    expect(getComputedStyle(primary).minHeight).toBe('48px');
    expect(getComputedStyle(primary).fontSize).toBe('12px');
    expect(getComputedStyle(primary).backgroundColor).toBe('rgb(236, 232, 222)');
    expect(getComputedStyle(fallback).minHeight).toBe('48px');
    expect(getComputedStyle(fallback).fontSize).toBe('12px');
    expect(getComputedStyle(operationalCopy).fontSize).toBe('16px');
  });
});
