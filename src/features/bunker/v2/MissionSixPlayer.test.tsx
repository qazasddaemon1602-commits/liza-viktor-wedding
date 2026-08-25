import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionSixPlayer, type MissionSixPlayerReadModel } from './MissionSixPlayer';

const model: MissionSixPlayerReadModel = {
  instanceId: 'm6', status: 'active', remainingSeconds: 480, title: 'Общий протокол',
  intro: 'У каждого вагона свой фрагмент. Объедините данные и согласуйте один протокол.',
  viewer: { wagonId: 'w1', wagonNumber: 1, canVote: true },
  privateFragment: { key: 'f1', label: 'Фрагмент вагона 01', body: 'В архиве повторяется TUNNEL B.' }, fragmentShared: false,
  revealedFragments: [], fragmentsRevealed: 0, fragmentsTotal: 3,
  options: [
    { key: 'A', title: 'Протокол A', summary: 'TUNNEL A · SECTOR 03' },
    { key: 'B', title: 'Протокол B', summary: 'TUNNEL B · SECTOR 04' },
    { key: 'C', title: 'Протокол C', summary: 'SERVICE SHAFT · SECTOR 05' },
  ],
  selectedVote: null,
  wagonConsensus: [{ wagonId: 'w1', label: 'ВАГОН №1', votesA: 0, votesB: 1, votesC: 0, required: 3, consensus: null }],
  ability: null, connection: 'online',
};

describe('MissionSixPlayer', () => {
  it('reveals the private fragment automatically once per mission entry and removes the manual action', async () => {
    const reveal = vi.fn().mockResolvedValue(undefined);
    const view = render(<MissionSixPlayer model={model} onReveal={reveal} onVote={vi.fn()} onUseAbility={vi.fn()} />);

    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Фрагмент вагона 01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ПЕРЕДАТЬ ФРАГМЕНТ/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ПРОТОКОЛ [ABC]/ })).toHaveLength(3);

    view.rerender(<MissionSixPlayer model={{ ...model, remainingSeconds: 479 }} onReveal={reveal} onVote={vi.fn()} />);
    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1));

    view.rerender(<MissionSixPlayer model={{ ...model, instanceId: 'm6-next' }} onReveal={reveal} onVote={vi.fn()} />);
    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(2));
  });

  it('allows an explicit same-instance retry after automatic reveal is rejected without looping', async () => {
    const reveal = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const view = render(<MissionSixPlayer model={model} onReveal={reveal} onVote={vi.fn()} />);

    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(reveal).toHaveBeenCalledTimes(1);

    const retryReveal = () => reveal();
    view.rerender(<MissionSixPlayer model={{ ...model, remainingSeconds: 479 }} onReveal={retryReveal} onVote={vi.fn()} />);

    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(2));
  });

  it('keeps fragment counters and abilities in secondary details', () => {
    render(<MissionSixPlayer model={{
      ...model,
      fragmentShared: true,
      ability: { available: true, key: 'protocol_check', label: 'Проверка протокола', hint: 'Можно сверить данные.' },
    }} onVote={vi.fn()} onUseAbility={vi.fn()} />);

    const details = screen.getByText('ДЕТАЛИ ОБЩЕГО ПРОТОКОЛА').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /ПРОВЕРИТЬ ПРОТОКОЛ/i, hidden: true })).not.toBeVisible();
    expect(screen.getByText(/ОБЩИЙ ПРОТОКОЛ · 0 \/ 3/i)).not.toBeVisible();
  });

  it('forwards a vote and explains that wagon consensus needs a majority', async () => {
    const user = userEvent.setup(); const vote = vi.fn();
    render(<MissionSixPlayer model={{ ...model, fragmentShared: true }} onReveal={vi.fn()} onVote={vote} onUseAbility={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /ПРОТОКОЛ B/ }));
    expect(vote).toHaveBeenCalledWith('B');
    expect(screen.getByRole('button', { name: /ПРОТОКОЛ B/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status', { name: 'Состояние вашего голоса' })).toHaveTextContent(
      /протокол B.*голос отправлен/i,
    );
    expect(screen.getByText(/нужно 3 голоса/i)).toBeInTheDocument();
  });

  it('keeps the submitted vote selected while polling still returns the previous value', async () => {
    const user = userEvent.setup();
    const view = render(
      <MissionSixPlayer model={{ ...model, fragmentShared: true }} onVote={vi.fn().mockResolvedValue(undefined)} />,
    );

    await user.click(screen.getByRole('button', { name: /ПРОТОКОЛ C/ }));
    view.rerender(
      <MissionSixPlayer
        model={{ ...model, fragmentShared: true, remainingSeconds: 478, selectedVote: null }}
        onVote={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: /ПРОТОКОЛ C/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status', { name: 'Состояние вашего голоса' })).toHaveTextContent(/протокол C/i);
  });

  it('marks an authoritative vote as accepted and keeps it visible', () => {
    render(<MissionSixPlayer model={{ ...model, fragmentShared: true, selectedVote: 'B' }} />);

    expect(screen.getByRole('button', { name: /ПРОТОКОЛ B/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status', { name: 'Состояние вашего голоса' })).toHaveTextContent(
      /ответ принят.*протокол B/i,
    );
  });

  it('shows unlocked sector and access code only after authoritative success', () => {
    render(<MissionSixPlayer model={{ ...model, status: 'completed', outcome: { status: 'success', protocol: 'B', sector: '04', accessCode: '4719' } }} onReveal={vi.fn()} onVote={vi.fn()} onUseAbility={vi.fn()} />);
    expect(screen.getByText(/SECTOR 04/i)).toBeInTheDocument();
    expect(screen.getByText(/4719/)).toBeInTheDocument();
  });
});
