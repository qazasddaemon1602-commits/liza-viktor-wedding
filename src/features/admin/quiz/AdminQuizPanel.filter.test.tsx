import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminQuizPanel, type AdminQuizPanelDependencies } from './AdminQuizPanel';

it('keeps final-five questions out of the standard quiz panel', async () => {
  const dependencies: AdminQuizPanelDependencies = {
    load: vi.fn().mockResolvedValue({
      status: 'ok',
      phase: 'idle',
      currentQuestionId: null,
      answeredCount: 0,
      questions: [
        { id: 's1', text: 'Кто дольше собирается?', questionType: 'standard', sortOrder: 1, enabled: true, imagePath: null },
        { id: 'f1', text: 'Кто главный?', questionType: 'final_five', sortOrder: 101, enabled: true, imagePath: null },
      ],
    }),
    seed: vi.fn().mockResolvedValue({ status: 'existing', insertedCount: 0 }),
    activate: vi.fn(),
    reveal: vi.fn(),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
  };

  render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

  expect(await screen.findByText('Кто дольше собирается?')).toBeInTheDocument();
  expect(screen.queryByText('Кто главный?')).not.toBeInTheDocument();
});
