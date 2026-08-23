import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminQuizControl } from '../../quiz/adminQuiz.service';
import { AdminQuizLiveControl } from './AdminQuizLiveControl';

const control: Extract<AdminQuizControl, { phase: 'voting' }> = {
  status: 'ok',
  phase: 'voting',
  currentQuestionId: 'question-1',
  answeredCount: 18,
  phaseEndsAt: '2026-08-30T12:00:30.000Z',
  questions: [],
};

describe('AdminQuizLiveControl', () => {
  it('uses SceneTransition only around the live question and leaves the answered count outside its live region', () => {
    render(
      <AdminQuizLiveControl
        control={control}
        question={{ id: 'question-1', text: 'Кто первым собрал чемодан?', questionType: 'standard', sortOrder: 1, enabled: true, imagePath: null }}
        busy=""
        hasNext
        onReveal={vi.fn()}
        onClose={vi.fn()}
        onNext={vi.fn()}
        onReturnMain={vi.fn()}
        onDeadline={vi.fn()}
      />,
    );

    expect(screen.getByTestId('scene-transition')).toHaveAttribute('data-scene-key', 'question-1:voting');
    expect(screen.getByRole('status')).toHaveTextContent('ВОПРОС ОТКРЫТ · ГОСТИ ВЫБИРАЮТ ОТВЕТ');
    expect(screen.getByText('18 ОТВЕТИЛИ')).not.toHaveAttribute('aria-live');
  });
});
