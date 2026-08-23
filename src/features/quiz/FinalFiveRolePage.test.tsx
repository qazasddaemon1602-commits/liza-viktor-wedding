import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FinalFiveRolePage,
  type FinalFiveRolePageDependencies,
} from './FinalFiveRolePage';
import type { LizaBunkerOperatorPanelDependencies } from '../bunker/operator/LizaBunkerOperatorPanel';

function deps(overrides: Partial<FinalFiveRolePageDependencies> = {}): FinalFiveRolePageDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'active',
      role: 'liza',
      phase: 'voting',
      question: { id: 'q1', text: 'Кто главный?' },
      selectedChoice: null,
    }),
    submit: vi.fn().mockResolvedValue({
      status: 'accepted',
      questionId: 'q1',
      role: 'liza',
      choice: 'viktor',
    }),
    subscribeToRefresh: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

describe('FinalFiveRolePage', () => {
  it('enters BK-17 mode for Liza only while Bunker is active', async () => {
    const operatorDependencies: LizaBunkerOperatorPanelDependencies = {
      load: vi.fn().mockResolvedValue({
        status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:00:00Z',
      }),
      submit: vi.fn(), subscribe: vi.fn(() => vi.fn()), broadcast: vi.fn(),
    };
    const dependencies = deps();
    render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={dependencies} operatorDependencies={operatorDependencies} />);
    expect(await screen.findByText('ОПЕРАТОР BK-17 · PRIVATE CHANNEL')).toBeInTheDocument();
    expect(screen.getByText('СОСТАВ В ПУТИ')).toBeInTheDocument();
    expect(dependencies.load).not.toHaveBeenCalled();
  });

  it('preserves Final Five for Liza when Bunker is inactive and never probes it for Viktor', async () => {
    const lizaOperator = depsOperator({
      load: vi.fn().mockResolvedValue({ status: 'idle', bunkerActive: false, serverNow: '2026-08-23T12:00:00Z', globalGameState: null }),
    });
    const finalFiveDependencies = deps({ load: vi.fn().mockResolvedValue({ status: 'idle', role: 'liza' }) });
    const { unmount } = render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={finalFiveDependencies} operatorDependencies={lizaOperator} />);
    expect(await screen.findByText('ЖДЁМ ФИНАЛЬНЫЙ РАУНД')).toBeInTheDocument();
    expect(finalFiveDependencies.load).toHaveBeenCalledTimes(1);
    unmount();

    const viktorOperator = depsOperator();
    render(<FinalFiveRolePage role="viktor" token="secret-token" dependencies={deps()} operatorDependencies={viktorOperator} />);
    expect(await screen.findByText('ВИКТОР · ЛИЧНЫЙ ОТВЕТ')).toBeInTheDocument();
    expect(viktorOperator.load).not.toHaveBeenCalled();
  });

  it('drops an active operator session when the private token changes', async () => {
    const operatorDependencies = depsOperator({
      load: vi.fn()
        .mockResolvedValueOnce({
          status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:00:00Z',
        })
        .mockResolvedValueOnce({ status: 'invalid_access' }),
    });
    const view = render(<FinalFiveRolePage
      role="liza"
      token="valid-token"
      dependencies={deps()}
      operatorDependencies={operatorDependencies}
    />);
    expect(await screen.findByText('СОСТАВ В ПУТИ')).toBeInTheDocument();
    view.rerender(<FinalFiveRolePage
      role="liza"
      token="revoked-token"
      dependencies={deps()}
      operatorDependencies={operatorDependencies}
    />);
    expect(await screen.findByText('ССЫЛКА НЕДЕЙСТВИТЕЛЬНА')).toBeInTheDocument();
  });

  it('returns to the existing Final Five UX when the active Bunker ends', async () => {
    let latestRefresh: (() => void) | undefined;
    const operatorDependencies = depsOperator({
      load: vi.fn()
        .mockResolvedValue({
          status: 'idle', bunkerActive: false, globalGameState: null, serverNow: '2026-08-23T12:01:00Z',
        })
        .mockResolvedValueOnce({
          status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:00:00Z',
        })
        .mockResolvedValueOnce({
          status: 'idle', bunkerActive: false, globalGameState: null, serverNow: '2026-08-23T12:01:00Z',
        }),
      subscribe: vi.fn((callback) => { latestRefresh = callback; return vi.fn(); }),
    });
    const finalFiveDependencies = deps({ load: vi.fn().mockResolvedValue({ status: 'idle', role: 'liza' }) });
    render(<FinalFiveRolePage
      role="liza"
      token="secret-token"
      dependencies={finalFiveDependencies}
      operatorDependencies={operatorDependencies}
    />);
    expect(await screen.findByText('СОСТАВ В ПУТИ')).toBeInTheDocument();
    await act(async () => { latestRefresh?.(); await Promise.resolve(); });
    expect(await screen.findByText('ЖДЁМ ФИНАЛЬНЫЙ РАУНД')).toBeInTheDocument();
    expect(finalFiveDependencies.load).toHaveBeenCalledTimes(1);
  });

  it('shows only Liza own private live answer UI and saves her choice', async () => {
    const dependencies = deps();
    render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={dependencies} />);

    expect(await screen.findByText('ЛИЗА · ЛИЧНЫЙ ОТВЕТ')).toBeInTheDocument();
    expect(screen.getByText('Кто главный?')).toBeInTheDocument();
    expect(screen.queryByText(/ВИКТОР ОТВЕТИЛ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ГОСТИ/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ВИКТОР' }));

    await waitFor(() => expect(dependencies.submit).toHaveBeenCalledWith('secret-token', 'q1', 'viktor'));
    expect(screen.getByRole('button', { name: 'ВИКТОР' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Viktor own saved choice without exposing Liza live answer', async () => {
    render(<FinalFiveRolePage role="viktor" token="secret-token" dependencies={deps({
      load: vi.fn().mockResolvedValue({
        status: 'active',
        role: 'viktor',
        phase: 'voting',
        question: { id: 'q2', text: 'Кто первым мирится?' },
        selectedChoice: 'liza',
      }),
    })} />);

    expect(await screen.findByText('ВИКТОР · ЛИЧНЫЙ ОТВЕТ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЛИЗА' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/ЛИЗА ОТВЕТИЛА/i)).not.toBeInTheDocument();
  });

  it('locks the role UI after guest results are opened', async () => {
    render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={deps({
      load: vi.fn().mockResolvedValue({
        status: 'active',
        role: 'liza',
        phase: 'results',
        question: { id: 'q1', text: 'Кто главный?' },
        selectedChoice: 'liza',
      }),
    })} />);

    expect(await screen.findByText('ОТВЕТ ПРИНЯТ')).toBeInTheDocument();
    expect(screen.getByText('ЖДЁМ ПОКАЗА')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЛИЗА' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ВИКТОР' })).toBeDisabled();
  });

  it('shows waiting and invalid-access states without leaking any quiz data', async () => {
    const { rerender } = render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={deps({
      load: vi.fn().mockResolvedValue({ status: 'idle', role: 'liza' }),
    })} />);

    expect(await screen.findByText('ЖДЁМ ФИНАЛЬНЫЙ РАУНД')).toBeInTheDocument();

    rerender(<FinalFiveRolePage role="liza" token="bad-token" dependencies={deps({
      load: vi.fn().mockResolvedValue({ status: 'invalid_access' }),
    })} />);

    expect(await screen.findByText('ССЫЛКА НЕДЕЙСТВИТЕЛЬНА')).toBeInTheDocument();
  });

  it('reloads only its private state on the shared quiz refresh signal', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce({ status: 'idle', role: 'liza' })
      .mockResolvedValueOnce({
        status: 'active',
        role: 'liza',
        phase: 'voting',
        question: { id: 'q1', text: 'Кто главный?' },
        selectedChoice: null,
      });
    const dependencies = deps({
      load,
      subscribeToRefresh: vi.fn((callback) => {
        refresh = callback;
        return vi.fn();
      }),
    });

    render(<FinalFiveRolePage role="liza" token="secret-token" dependencies={dependencies} />);
    expect(await screen.findByText('ЖДЁМ ФИНАЛЬНЫЙ РАУНД')).toBeInTheDocument();

    act(() => refresh?.());

    expect(await screen.findByText('Кто главный?')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

function depsOperator(overrides: Partial<LizaBunkerOperatorPanelDependencies> = {}): LizaBunkerOperatorPanelDependencies {
  return {
    load: vi.fn().mockResolvedValue({ status: 'idle', bunkerActive: false, serverNow: '2026-08-23T12:00:00Z', globalGameState: null }),
    submit: vi.fn(), subscribe: vi.fn(() => vi.fn()), broadcast: vi.fn(), ...overrides,
  };
}
