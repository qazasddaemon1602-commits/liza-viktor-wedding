import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminQuizPanel,
  type AdminQuizPanelDependencies,
} from './AdminQuizPanel';
import type { AdminQuizControl } from '../../quiz/adminQuiz.service';

const votingControl: AdminQuizControl = {
  status: 'ok',
  phase: 'voting',
  currentQuestionId: 'question-2',
  answeredCount: 18,
  questions: [
    {
      id: 'question-1',
      text: 'Кто дольше собирается?',
      questionType: 'standard',
      sortOrder: 1,
      enabled: true,
      imagePath: null,
    },
    {
      id: 'question-2',
      text: 'Кто первым мирится после ссоры?',
      questionType: 'standard',
      sortOrder: 2,
      enabled: true,
      imagePath: null,
    },
  ],
};

function deps(overrides: Partial<AdminQuizPanelDependencies> = {}): AdminQuizPanelDependencies {
  return {
    load: vi.fn().mockResolvedValue(votingControl),
    seed: vi.fn().mockResolvedValue({ status: 'existing', insertedCount: 0 }),
    activate: vi.fn().mockResolvedValue({ status: 'active', questionId: 'question-1', phase: 'voting' }),
    reveal: vi.fn().mockResolvedValue({
      status: 'revealed',
      questionId: 'question-2',
      results: { liza: 18, viktor: 12, total: 30 },
    }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AdminQuizPanel', () => {
  it('shows current question and answered count without exposing result split before reveal', async () => {
    render(<AdminQuizPanel eventId="event-1" dependencies={deps()} />);

    expect(await screen.findByText('Кто первым мирится после ссоры?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ЛИЗА ИЛИ ВИКТОР?' })).toBeInTheDocument();
    expect(screen.getByText(/18 ОТВЕТИЛИ/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС' })).toBeEnabled();
  });

  it('seeds the default pool when no questions exist', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'ok',
        phase: 'idle',
        currentQuestionId: null,
        answeredCount: 0,
        questions: [],
      })
      .mockResolvedValueOnce({
        ...votingControl,
        phase: 'idle',
        currentQuestionId: null,
        answeredCount: 0,
      });
    const seed = vi.fn().mockResolvedValue({ status: 'seeded', insertedCount: 30 });
    const dependencies = deps({ load, seed });

    render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

    const seedButton = await screen.findByRole('button', { name: 'ДОБАВИТЬ 30 ВОПРОСОВ' });
    fireEvent.click(seedButton);

    await waitFor(() => expect(seed).toHaveBeenCalledWith('event-1'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Кто дольше собирается?')).toBeInTheDocument();
  });

  it('activates a selected question, broadcasts refresh, and reloads owner state', async () => {
    const idleControl: AdminQuizControl = {
      ...votingControl,
      phase: 'idle',
      currentQuestionId: null,
      answeredCount: 0,
    };
    const load = vi.fn()
      .mockResolvedValueOnce(idleControl)
      .mockResolvedValueOnce(votingControl);
    const activate = vi.fn().mockResolvedValue({
      status: 'active',
      questionId: 'question-2',
      phase: 'voting',
    });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({ load, activate, broadcastRefresh });

    render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ЗАПУСТИТЬ: Кто первым мирится после ссоры?' }));

    await waitFor(() => expect(activate).toHaveBeenCalledWith('event-1', 'question-2'));
    await waitFor(() => expect(broadcastRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/18 ОТВЕТИЛИ/i)).toBeInTheDocument();
  });

  it('reveals aggregate percentages only after the owner closes answers', async () => {
    const resultsControl: AdminQuizControl = {
      ...votingControl,
      phase: 'results',
      answeredCount: 30,
      results: { liza: 18, viktor: 12, total: 30 },
    };
    const load = vi.fn()
      .mockResolvedValueOnce(votingControl)
      .mockResolvedValueOnce(resultsControl);
    const reveal = vi.fn().mockResolvedValue({
      status: 'revealed',
      questionId: 'question-2',
      results: { liza: 18, viktor: 12, total: 30 },
    });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({ load, reveal, broadcastRefresh });

    render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС' }));

    await waitFor(() => expect(reveal).toHaveBeenCalledWith('event-1', 'question-2'));
    await waitFor(() => expect(broadcastRefresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('ЛИЗА 60%')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР 40%')).toBeInTheDocument();
  });
});

