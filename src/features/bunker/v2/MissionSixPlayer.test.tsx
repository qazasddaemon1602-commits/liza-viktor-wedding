import { render, screen } from '@testing-library/react';
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
  it('puts the private fragment before voting and has one clear share action', () => {
    render(<MissionSixPlayer model={model} onReveal={vi.fn()} onVote={vi.fn()} onUseAbility={vi.fn()} />);
    expect(screen.getByText('Фрагмент вагона 01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПЕРЕДАТЬ ФРАГМЕНТ В ОБЩИЙ ПРОТОКОЛ' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ПРОТОКОЛ [ABC]/ })).toHaveLength(3);
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
