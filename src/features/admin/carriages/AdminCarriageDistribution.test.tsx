import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminCarriageDistribution } from './AdminCarriageDistribution';

describe('AdminCarriageDistribution', () => {
  it('recommends two balanced carriages for eighteen registered guests', () => {
    render(<AdminCarriageDistribution guestCount={18} compositionLocked={false} onAccept={vi.fn()} />);

    expect(screen.getByText('Участников в распределении: 18')).toBeInTheDocument();
    expect(screen.getByText('Рекомендуемое количество вагонов: 2')).toBeInTheDocument();
    expect(screen.getByText('Вагон №1 — 9')).toBeInTheDocument();
    expect(screen.getByText('Вагон №2 — 9')).toBeInTheDocument();
  });

  it('lets the owner choose another supported scale and previews the new balance', async () => {
    const user = userEvent.setup();
    render(<AdminCarriageDistribution guestCount={20} compositionLocked={false} onAccept={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Количество вагонов'), '2');

    expect(screen.getByText('Вагон №1 — 10')).toBeInTheDocument();
    expect(screen.getByText('Вагон №2 — 10')).toBeInTheDocument();
    expect(screen.queryByText('Вагон №3 — 6')).not.toBeInTheDocument();
  });

  it('warns below twelve guests but keeps acceptance available', () => {
    render(<AdminCarriageDistribution guestCount={11} compositionLocked={false} onAccept={vi.fn()} />);

    expect(screen.getByText(
      'Для полноценного режима «Последний вагон» рекомендуется минимум 12 участников.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПРИНЯТЬ РАСПРЕДЕЛЕНИЕ' })).toBeEnabled();
  });

  it('accepts the selected carriage count once and shows the fixed state', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AdminCarriageDistribution guestCount={24} compositionLocked={false} onAccept={onAccept} />,
    );

    await user.click(screen.getByRole('button', { name: 'ПРИНЯТЬ РАСПРЕДЕЛЕНИЕ' }));
    expect(onAccept).toHaveBeenCalledWith(3);

    rerender(<AdminCarriageDistribution guestCount={24} compositionLocked onAccept={onAccept} />);
    expect(screen.getByText('СОСТАВ ЗАФИКСИРОВАН')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ПРИНЯТЬ РАСПРЕДЕЛЕНИЕ' })).not.toBeInTheDocument();
  });

  it('restores the actually locked scale instead of reverting to the recommendation', () => {
    render(
      <AdminCarriageDistribution
        guestCount={20}
        compositionLocked
        activeCarriageCount={2}
        onAccept={vi.fn()}
      />,
    );

    expect(screen.getByText('Вагон №1 — 10')).toBeInTheDocument();
    expect(screen.getByText('Вагон №2 — 10')).toBeInTheDocument();
    expect(screen.queryByText('Вагон №3 — 6')).not.toBeInTheDocument();
  });

  it('tracks a changing recommendation until the owner makes a manual choice', () => {
    const { rerender } = render(
      <AdminCarriageDistribution guestCount={18} compositionLocked={false} onAccept={vi.fn()} />,
    );
    expect(screen.getByLabelText('Количество вагонов')).toHaveValue('2');

    rerender(<AdminCarriageDistribution guestCount={20} compositionLocked={false} onAccept={vi.fn()} />);
    expect(screen.getByLabelText('Количество вагонов')).toHaveValue('3');
  });
});
