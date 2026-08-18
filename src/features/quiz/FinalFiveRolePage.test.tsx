import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FinalFiveRolePage,
  type FinalFiveRolePageDependencies,
} from './FinalFiveRolePage';

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
