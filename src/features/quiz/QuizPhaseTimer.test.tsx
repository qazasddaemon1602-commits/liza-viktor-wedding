import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizPhaseTimer } from './QuizPhaseTimer';

describe('QuizPhaseTimer', () => {
  it('shows only the remaining time from the server deadline', () => {
    const nowMs = Date.parse('2026-08-19T10:00:00.000Z');
    render(
      <QuizPhaseTimer
        endsAt="2026-08-19T10:00:18.000Z"
        now={() => nowMs}
      />,
    );

    expect(screen.getByText('00:18')).toBeInTheDocument();
  });

  it('renders nothing for an untimed manual round such as Final Five', () => {
    const { container } = render(<QuizPhaseTimer endsAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
