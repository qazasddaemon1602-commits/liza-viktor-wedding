import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissionTwoOwnerPanel } from './MissionTwoOwnerPanel';

describe('MissionTwoOwnerPanel', () => {
  it('shows progress, attempts and hints without rendering the secret answer', () => {
    render(<MissionTwoOwnerPanel model={{
      status: 'active', title: 'Чёрный ящик', remainingSeconds: 241,
      wagons: [{ wagonId: '1', label: 'ВАГОН №1', status: 'active', attemptCount: 1, hintsUsed: 1 }],
    }} />);
    expect(screen.getByText('ВАГОН №1')).toBeInTheDocument();
    expect(screen.getByText(/попыток использовано: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/подсказок использовано: 1/i)).toBeInTheDocument();
    expect(screen.queryByText('Открытие технического шлюза')).not.toBeInTheDocument();
  });
});
