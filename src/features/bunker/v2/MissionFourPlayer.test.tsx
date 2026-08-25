import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionFourPlayer, type MissionFourPlayerReadModel } from './MissionFourPlayer';

const PREPARED_MESSAGE_NAME = 'Сектор 04 найден. Сверьте данные.';

const base: MissionFourPlayerReadModel = {
  instanceId: 'm4', status: 'active', remainingSeconds: 300, title: 'Межвагонная связь', interactionPhase: 'exchange',
  group: { key: 'g', wagons: [{ id: 'w1', number: 1, label: 'ВАГОН №1' }, { id: 'w2', number: 2, label: 'ВАГОН №2' }] },
  viewer: { wagonId: 'w1', wagonNumber: 1, isOperator: true },
  messageQuota: 3, messagesRemaining: 3, messages: [], inventory: [{ itemKey: 'water', quantity: 2 }], trades: [],
  answer: { options: ['СВЯЗЬ', 'ПИТАНИЕ', 'МАРШРУТ'], selected: null, answeredWagons: 0, totalWagons: 2 },
  ability: null, connection: 'online',
};

describe('MissionFourPlayer', () => {
  it('offers the communicator exactly three prepared valid messages through the existing send action', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue(undefined);
    render(<MissionFourPlayer model={base} onSend={send} />);

    const prepared = screen.getByRole('region', { name: 'Готовые сообщения' });
    const actions = within(prepared).getAllByRole('button');
    expect(actions).toHaveLength(3);
    for (const action of actions) {
      expect(action).toHaveTextContent(/04/);
      expect(action).toHaveTextContent(/сектор|тоннель|маршрут/i);
    }

    await user.click(actions[1]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(actions[1].textContent);
    expect(screen.queryByRole('region', { name: 'Готовые сообщения' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Сообщение связиста' })).toHaveTextContent(
      /сообщение отправлено.*обсуждайте ответ.*ждём остальные вагоны/i,
    );
  });

  it('keeps free text, trades, and history available as secondary actions', async () => {
    const user = userEvent.setup();
    render(<MissionFourPlayer model={base} onSend={vi.fn()} onProposeTrade={vi.fn()} onRespondTrade={vi.fn()} />);

    const extras = screen.getByText('ДОПОЛНИТЕЛЬНЫЕ ДЕЙСТВИЯ').closest('details');
    expect(extras).not.toBeNull();
    expect(extras).not.toHaveAttribute('open');
    await user.click(within(extras as HTMLElement).getByText('ДОПОЛНИТЕЛЬНЫЕ ДЕЙСТВИЯ'));
    expect(screen.getByRole('textbox', { name: /сообщение соседнему вагону/i })).toHaveAttribute('maxlength', '120');
    expect(screen.getByRole('region', { name: 'Обмен ресурсами' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'История обменов' })).toBeInTheDocument();
  });

  it('removes send and trade controls in answer phase and shows one consensus CTA', () => {
    render(<MissionFourPlayer model={{ ...base, interactionPhase: 'answer' }} onAnswer={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'Готовые сообщения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ОТВЕТ ВАГОНА' })).toBeInTheDocument();
  });

  it('does not show message or trade controls to a non-operator', () => {
    render(<MissionFourPlayer model={{ ...base, viewer: { ...base.viewer, isOperator: false } }} />);
    expect(screen.queryByRole('region', { name: 'Готовые сообщения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Ваша роль в задании' })).toHaveTextContent(/вы помогаете обсуждать.*связист вагона отправляет/i);
  });

  it('restores prepared messages and shows retry guidance when sending is rejected', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionFourPlayer model={base} onSend={send} />);

    await user.click(screen.getByRole('button', { name: PREPARED_MESSAGE_NAME }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/сообщение не отправлено.*попробуйте ещё раз/i);
    expect(screen.getByRole('region', { name: 'Готовые сообщения' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PREPARED_MESSAGE_NAME })).toBeEnabled();
  });

  it('keeps the selected common answer and restores confirmation when sending is rejected', async () => {
    const user = userEvent.setup();
    const answer = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MissionFourPlayer model={{ ...base, interactionPhase: 'answer' }} onAnswer={answer} />);

    await user.click(screen.getByRole('radio', { name: 'СВЯЗЬ' }));
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ОТВЕТ ВАГОНА' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ответ не отправлен.*попробуйте ещё раз/i);
    expect(screen.getByRole('radio', { name: 'СВЯЗЬ' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ОТВЕТ ВАГОНА' })).toBeEnabled();
  });
});
