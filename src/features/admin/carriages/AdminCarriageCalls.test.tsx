import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminCarriageCalls } from './AdminCarriageCalls';

const carriages = [
  { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#31483A', visualMark: '01' },
  { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02' },
  { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
];

describe('AdminCarriageCalls', () => {
  it('sends a message to one or multiple selected carriages', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      callId: 'call-1',
      message: 'Готовимся к следующему конкурсу',
      targetCarriageIds: ['c2', 'c4'],
      showOnScreen: true,
      createdAt: '2026-08-30T13:00:00+05:00',
    });
    render(<AdminCarriageCalls carriages={carriages} onSend={onSend} onClear={vi.fn()} />);

    await user.click(screen.getByLabelText('Выбрать ВАГОН №2'));
    await user.click(screen.getByLabelText('Выбрать ВАГОН №4'));
    await user.type(screen.getByLabelText('Сообщение вагонам'), 'Готовимся к следующему конкурсу');
    await user.click(screen.getByLabelText('Показать также на общем экране'));
    await user.click(screen.getByRole('button', { name: 'ОТПРАВИТЬ ВЫЗОВ' }));

    expect(onSend).toHaveBeenCalledWith(
      ['c2', 'c4'],
      'Готовимся к следующему конкурсу',
      true,
    );
    expect(await screen.findByText('ВЫЗОВ АКТИВЕН')).toBeInTheDocument();
  });

  it('does not send until at least one carriage and a message are selected', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<AdminCarriageCalls carriages={carriages} onSend={onSend} onClear={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'ОТПРАВИТЬ ВЫЗОВ' }));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText(/выберите хотя бы один вагон/i)).toBeInTheDocument();
  });

  it('clears the active call and keeps its carriage targets for realtime refresh', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminCarriageCalls
        carriages={carriages}
        onSend={vi.fn()}
        onClear={onClear}
        initialActiveCall={{
          callId: 'call-1',
          message: 'ВАГОНЫ №2 И №4 — ГОТОВИМСЯ',
          targetCarriageIds: ['c2', 'c4'],
          showOnScreen: false,
          createdAt: '2026-08-30T13:00:00+05:00',
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'СНЯТЬ ВЫЗОВ' }));

    expect(onClear).toHaveBeenCalledWith('call-1', ['c2', 'c4']);
    expect(screen.queryByText('ВЫЗОВ АКТИВЕН')).not.toBeInTheDocument();
  });

  it('gives the owner a dedicated control to show the live carriage map on the projector', async () => {
    const user = userEvent.setup();
    const onShowMap = vi.fn().mockResolvedValue(undefined);
    const props = {
      carriages,
      onSend: vi.fn(),
      onClear: vi.fn(),
      onShowMap,
    } as unknown as React.ComponentProps<typeof AdminCarriageCalls>;
    render(<AdminCarriageCalls {...props} />);

    await user.click(screen.getByRole('button', { name: 'ПОКАЗАТЬ КАРТУ ВАГОНОВ НА ОБЩЕМ ЭКРАНЕ' }));

    expect(onShowMap).toHaveBeenCalledTimes(1);
  });
});
