import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BunkerTestPanel } from './BunkerTestPanel';

function callbacks() {
  return {
    onSeed: vi.fn(),
    onPrepare: vi.fn(),
    onAccelerate: vi.fn(),
    onSimulate: vi.fn(),
    onResetProgress: vi.fn(),
    onResetRegistrations: vi.fn(),
    onFullReset: vi.fn(),
    onSetInventory: vi.fn(),
    onSetWagonState: vi.fn(),
  };
}

describe('BunkerTestPanel', () => {
  it('makes rehearsal actions understandable without technical language', () => {
    render(
      <BunkerTestPanel
        state={{ gameMode: 'test', globalState: 'MISSION_03' }}
        {...callbacks()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ ИГРЫ' })).toBeInTheDocument();
    expect(screen.getByText(/реальные регистрации сохраняются/i)).toBeInTheDocument();
    expect(screen.getByText(/реальные \+ тестовые/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ДО 20 ГОСТЕЙ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'УСКОРИТЬ НА 1 МИНУТУ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'СИМУЛИРОВАТЬ ТЕКУЩИЙ ЭТАП' })).toBeInTheDocument();
    expect(screen.getByText(/работают только в режиме репетиции/i)).toBeInTheDocument();
  });

  it('disables rehearsal sizes below the number of real registrations', () => {
    render(
      <BunkerTestPanel
        state={{ gameMode: 'idle', globalState: null, realGuestCount: 25 }}
        {...callbacks()}
      />,
    );

    expect(screen.getByText(/сейчас реальных гостей: 25/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ДО 15 ГОСТЕЙ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ДО 20 ГОСТЕЙ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ДО 30 ГОСТЕЙ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'ДО 40 ГОСТЕЙ' })).toBeEnabled();
  });

  it('locks roster-changing actions while a rehearsal run is active', () => {
    render(
      <BunkerTestPanel
        state={{ gameMode: 'test', globalState: 'MISSION_03', realGuestCount: 12 }}
        {...callbacks()}
      />,
    );

    expect(screen.getByRole('button', { name: 'ДО 20 ГОСТЕЙ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ПОДГОТОВИТЬ ТЕСТОВУЮ ИГРУ' })).toBeDisabled();
    expect(screen.getByText(/сначала сбросьте только игровой прогресс/i)).toBeInTheDocument();
  });

  it('keeps destructive reset commands disabled during a production game even after exact confirmations are typed', async () => {
    const user = userEvent.setup();
    const handlers = callbacks();
    render(
      <BunkerTestPanel
        state={{ gameMode: 'production', globalState: 'FINAL_30' }}
        {...handlers}
      />,
    );

    const resetRegistrations = screen.getByRole('button', { name: 'СБРОСИТЬ ИГРУ + РЕГИСТРАЦИИ' });
    const fullReset = screen.getByRole('button', { name: 'ПОЛНЫЙ СБРОС ВЕЧЕРА' });
    const resetProgress = screen.getByRole('button', { name: 'СБРОСИТЬ ТОЛЬКО ИГРОВОЙ ПРОГРЕСС' });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0]!, 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ');
    await user.type(inputs[1]!, 'СБРОСИТЬ');

    expect(resetProgress).toBeDisabled();
    expect(resetRegistrations).toBeDisabled();
    expect(fullReset).toBeDisabled();
    expect(handlers.onResetProgress).not.toHaveBeenCalled();
    expect(handlers.onResetRegistrations).not.toHaveBeenCalled();
    expect(handlers.onFullReset).not.toHaveBeenCalled();
  });
});