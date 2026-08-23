import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestMessageCapsuleDock } from './GuestMessageCapsuleDock';

describe('GuestMessageCapsuleDock', () => {
  it('loads, edits, and saves one message up to 280 characters', async () => {
    const load = vi.fn().mockResolvedValue({
      status: 'ready', open: true, maxLength: 280, message: null, updatedAt: null,
    });
    const save = vi.fn().mockResolvedValue({
      status: 'saved', message: 'Любви на всю жизнь!', updatedAt: '2026-08-24T00:00:00Z',
    });

    render(<GuestMessageCapsuleDock load={load} save={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть капсулу сообщений' }));

    const input = await screen.findByLabelText('Сообщение Лизе и Виктору');
    expect(input).toHaveAttribute('maxLength', '280');
    fireEvent.change(input, { target: { value: 'Любви на всю жизнь!' } });
    fireEvent.click(screen.getByRole('button', { name: 'СОХРАНИТЬ В КАПСУЛУ' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith('Любви на всю жизнь!'));
    expect(await screen.findByText('СОХРАНЕНО')).toBeInTheDocument();
  });

  it('keeps a saved message readable when the capsule is closed', async () => {
    const load = vi.fn().mockResolvedValue({
      status: 'ready', open: false, maxLength: 280, message: 'Спасибо за этот вечер!', updatedAt: '2026-08-24T00:00:00Z',
    });
    const save = vi.fn();
    render(<GuestMessageCapsuleDock load={load} save={save} />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть капсулу сообщений' }));
    expect(await screen.findByDisplayValue('Спасибо за этот вечер!')).toBeDisabled();
    expect(screen.getByText('ПРИЁМ СООБЩЕНИЙ ЗАКРЫТ')).toBeInTheDocument();
  });
});
