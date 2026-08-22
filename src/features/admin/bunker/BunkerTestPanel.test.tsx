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
