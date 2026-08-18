import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTestResetPanel } from './AdminTestResetPanel';

describe('AdminTestResetPanel', () => {
  it('requires an explicit typed confirmation and explains what survives the reset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn().mockResolvedValue({
      deletedGuests: 32,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });

    render(<AdminTestResetPanel guestCount={32} onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ТЕСТОВЫЕ ДАННЫЕ' }));

    expect(screen.getByText(/ответы лизы и виктора сохранятся/i)).toBeInTheDocument();
    expect(screen.getByText(/настроенное видео премьеры сохранится/i)).toBeInTheDocument();
    expect(screen.getByText(/гости, голоса и текущие состояния будут удалены/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ СБРОС' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Введите СБРОСИТЬ'), 'СБРОСИТЬ');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onReset).toHaveBeenCalledWith('СБРОСИТЬ');
    expect(await screen.findByText(/удалено гостей: 32/i)).toBeInTheDocument();
    expect(screen.getByText(/сохранено ответов: 30/i)).toBeInTheDocument();
  });
});