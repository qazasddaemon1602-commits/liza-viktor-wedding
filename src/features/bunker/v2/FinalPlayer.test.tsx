import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FinalPlayer, type FinalPlayerModel } from './FinalPlayer';

const model: FinalPlayerModel = {
  remainingSeconds: 1800,
  title: '30 минут до Бункера',
  wagon: { number: 2, label: 'ВАГОН №2' },
  fragments: [{ parameter: 'sector', label: 'Сектор', part: 1, totalParts: 1, value: '04' }],
  terminal: { solved: 2, total: 5, wrongAttempts: 0, unlocked: false },
  hint: { level: 0, text: '' },
  connection: 'online',
};

describe('FinalPlayer', () => {
  it('explains the collaboration goal before showing the terminal', () => {
    render(<FinalPlayer model={model} onRequestAccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /30 МИНУТ ДО БУНКЕРА/i })).toBeInTheDocument();
    expect(screen.getByText(/у каждого вагона только часть данных/i)).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByLabelText('Координаты')).toBeInTheDocument();
  });

  it('requires all five fields and has one clear access action', async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<FinalPlayer model={model} onRequestAccess={submit} />);
    const button = screen.getByRole('button', { name: 'ЗАПРОСИТЬ ДОСТУП' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Координаты'), '57°09 / 65°32');
    await user.type(screen.getByLabelText('Сектор'), '04');
    await user.type(screen.getByLabelText('Код доступа'), '4719');
    await user.type(screen.getByLabelText('Время открытия ворот'), '23:40');
    await user.type(screen.getByLabelText('Пароль'), 'LV0830');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(submit).toHaveBeenCalledWith({ coordinates:'57°09 / 65°32',sector:'04',accessCode:'4719',gateTime:'23:40',password:'LV0830' });
  });

  it('shows automatic time-based help in plain language', () => {
    render(<FinalPlayer model={{...model,remainingSeconds:120,hint:{level:2,text:'Сверьте сектор и код доступа с досье BK-17.'}} onRequestAccess={vi.fn()} />);
    expect(screen.getByText(/сверьте сектор и код доступа/i)).toBeInTheDocument();
  });
});
