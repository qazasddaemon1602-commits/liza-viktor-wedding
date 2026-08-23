import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EveningNominationsOverlay } from './EveningNominationsOverlay';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('EveningNominationsOverlay', () => {
  it('reveals real awards one by one', () => {
    render(<EveningNominationsOverlay nominations={[
      { key: 'first_passenger', title: 'ПЕРВЫЙ ПАССАЖИР', recipient: 'Анна П.', detail: 'БИЛЕТ №001' },
      { key: 'mk_champion', title: 'ЧЕМПИОН ПОСЛЕДНЕГО КРУГА', recipient: 'Денис К.', detail: 'ВАГОН №1' },
    ]} stepMs={5000} />);

    expect(screen.getByText('ПЕРВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getByText('Анна П.')).toBeInTheDocument();
    expect(screen.queryByText('Денис К.')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('ЧЕМПИОН ПОСЛЕДНЕГО КРУГА')).toBeInTheDocument();
    expect(screen.getByText('Денис К.')).toBeInTheDocument();
  });
});
