import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPhaseTimer } from './QuizPhaseTimer';

describe('QuizPhaseTimer', () => {
  afterEach(() => vi.useRealTimers());

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

  it('announces each displayed second once for projector countdown audio', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-19T10:00:00.000Z');
    const onSecondChange = vi.fn();

    render(
      <QuizPhaseTimer
        endsAt="2026-08-19T10:00:06.000Z"
        onSecondChange={onSecondChange}
      />,
    );

    expect(onSecondChange).toHaveBeenCalledTimes(1);
    expect(onSecondChange).toHaveBeenLastCalledWith(6);
    act(() => vi.advanceTimersByTime(1_000));
    expect(onSecondChange).toHaveBeenCalledTimes(2);
    expect(onSecondChange).toHaveBeenLastCalledWith(5);
  });
});

