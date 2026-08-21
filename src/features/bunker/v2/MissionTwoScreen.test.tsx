import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissionTwoScreen } from './MissionTwoScreen';

describe('MissionTwoScreen', () => {
  it('shows only public progress and never the answer key', () => {
    render(<MissionTwoScreen model={{
      title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ', remainingSeconds: 300,
      wagons: [{ wagonId: '1', label: 'ВАГОН №1', status: 'active', attemptCount: 0 }, { wagonId: '2', label: 'ВАГОН №2', status: 'completed', attemptCount: 1 }],
    }} />);
    expect(screen.getByRole('heading', { name: 'ЧЁРНЫЙ ЯЩИК' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2 ГОТОВО')).toBeInTheDocument();
    expect(screen.queryByText('Вагон №4')).not.toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
  });
});
