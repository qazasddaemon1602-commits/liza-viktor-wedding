import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CouplePreanswersPage,
  type CouplePreanswersPageDependencies,
} from './CouplePreanswersPage';
import type { CouplePreanswerForm } from './couplePreanswers.service';

const initialForm: CouplePreanswerForm = {
  status: 'active',
  eventId: 'event-1',
  answeredCount: 1,
  totalCount: 2,
  questions: [
    {
      id: 'q1',
      text: 'Кто в доме главный?',
      sortOrder: 1,
      imagePath: null,
      choice: 'viktor',
    },
    {
      id: 'q2',
      text: 'Кто первым мирится?',
      sortOrder: 2,
      imagePath: null,
      choice: null,
    },
  ],
};

function deps(overrides: Partial<CouplePreanswersPageDependencies> = {}): CouplePreanswersPageDependencies {
  return {
    load: vi.fn().mockResolvedValue(initialForm),
    save: vi.fn().mockImplementation(async (_token, questionId, choice) => ({
      status: 'saved',
      questionId,
      choice,
    })),
    finalize: vi.fn().mockResolvedValue({ status: 'finalized', answerCount: 2 }),
    ...overrides,
  };
}

describe('CouplePreanswersPage', () => {
  it('shows saved joint choices and keeps finalization disabled until every question is answered', async () => {
    const dependencies = deps();
    render(<CouplePreanswersPage token="secret-token" dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'ОТВЕТЫ ЛИЗЫ И ВИКТОРА' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2 ОТВЕЧЕНО')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ВИКТОР — Кто в доме главный?' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ЗАФИКСИРОВАТЬ ОТВЕТЫ' })).toBeDisabled();
  });

  it('saves an answer immediately, updates progress, then finalizes and removes the hidden answers from the page', async () => {
    const dependencies = deps();
    render(<CouplePreanswersPage token="secret-token" dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ЛИЗА — Кто первым мирится?' }));

    await waitFor(() => expect(dependencies.save).toHaveBeenCalledWith('secret-token', 'q2', 'liza'));
    expect(screen.getByText('2 / 2 ОТВЕЧЕНО')).toBeInTheDocument();

    const finalizeButton = screen.getByRole('button', { name: 'ЗАФИКСИРОВАТЬ ОТВЕТЫ' });
    expect(finalizeButton).toBeEnabled();
    fireEvent.click(finalizeButton);

    await waitFor(() => expect(dependencies.finalize).toHaveBeenCalledWith('secret-token'));
    expect(await screen.findByRole('heading', { name: 'ОТВЕТЫ ЗАФИКСИРОВАНЫ' })).toBeInTheDocument();
    expect(screen.queryByText('Кто в доме главный?')).not.toBeInTheDocument();
    expect(screen.queryByText('Кто первым мирится?')).not.toBeInTheDocument();
  });

  it('allows changing an already-saved answer before finalization without double-counting progress', async () => {
    const dependencies = deps();
    render(<CouplePreanswersPage token="secret-token" dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ЛИЗА — Кто в доме главный?' }));

    await waitFor(() => expect(dependencies.save).toHaveBeenCalledWith('secret-token', 'q1', 'liza'));
    expect(screen.getByText('1 / 2 ОТВЕЧЕНО')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЛИЗА — Кто в доме главный?' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a consumed link as finished without revealing answers', async () => {
    const dependencies = deps({ load: vi.fn().mockResolvedValue({ status: 'finished' }) });
    render(<CouplePreanswersPage token="secret-token" dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'ОТВЕТЫ УЖЕ ЗАФИКСИРОВАНЫ' })).toBeInTheDocument();
    expect(screen.queryByText(/Кто в доме/)).not.toBeInTheDocument();
  });

  it('does not call the backend when the one-time token is missing', async () => {
    const dependencies = deps();
    render(<CouplePreanswersPage token="" dependencies={dependencies} />);

    expect(screen.getByRole('heading', { name: 'ССЫЛКА НЕДЕЙСТВИТЕЛЬНА' })).toBeInTheDocument();
    expect(dependencies.load).not.toHaveBeenCalled();
  });
});
