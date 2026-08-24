import { render, screen, within } from '@testing-library/react';
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
    expect(screen.queryByLabelText('Сектор')).not.toBeInTheDocument();
  });

  it('keeps one terminal value primary at a time and preserves values when navigating back', async () => {
    const user = userEvent.setup();
    render(<FinalPlayer model={model} onRequestAccess={vi.fn()} />);

    await user.type(screen.getByLabelText('Координаты'), '57°09 / 65°32');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Сектор'), '04');
    expect(screen.queryByLabelText('Координаты')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'НАЗАД' }));
    expect(screen.getByLabelText('Координаты')).toHaveValue('57°09 / 65°32');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    expect(screen.getByLabelText('Сектор')).toHaveValue('04');
  });

  it('reviews all five values and submits the unchanged access payload exactly once', async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<FinalPlayer model={model} onRequestAccess={submit} />);

    await user.type(screen.getByLabelText('Координаты'), '57°09 / 65°32');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Сектор'), '04');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Код доступа'), '4719');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Время открытия ворот'), '23:40');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Пароль'), 'LV0830');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));

    expect(screen.getByRole('heading', { name: 'ПРОВЕРЬТЕ ВСЕ ПЯТЬ ПАРАМЕТРОВ' })).toBeInTheDocument();
    const terminal = within(screen.getByRole('region', { name: 'Терминал доступа' }));
    expect(terminal.getByText('57°09 / 65°32')).toBeInTheDocument();
    expect(terminal.getByText('04')).toBeInTheDocument();
    expect(terminal.getByText('4719')).toBeInTheDocument();
    expect(terminal.getByText('23:40')).toBeInTheDocument();
    expect(terminal.getByText('LV0830')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'ЗАПРОСИТЬ ДОСТУП' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(submit).toHaveBeenCalledWith({ coordinates:'57°09 / 65°32',sector:'04',accessCode:'4719',gateTime:'23:40',password:'LV0830' });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('explains an incorrect version, accepted submission, and host recovery when access is unavailable', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FinalPlayer model={{ ...model, terminal: { ...model.terminal, solved: 0, wrongAttempts: 1 } }} onRequestAccess={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/последняя версия не подошла/i);

    rerender(<FinalPlayer model={model} onRequestAccess={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/подтвердил 2 из 5 параметров/i);

    await user.type(screen.getByLabelText('Координаты'), '57°09 / 65°32');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Сектор'), '04');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Код доступа'), '4719');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Время открытия ворот'), '23:40');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    await user.type(screen.getByLabelText('Пароль'), 'LV0830');
    await user.click(screen.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }));
    rerender(<FinalPlayer model={model} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/аварийное открытие Бункера/i);
    expect(screen.getByRole('button', { name: 'ЗАПРОСИТЬ ДОСТУП' })).toBeDisabled();
  });

  it('shows automatic time-based help in plain language', () => {
    render(<FinalPlayer model={{...model,remainingSeconds:120,hint:{level:2,text:'Сверьте сектор и код доступа с досье BK-17.'}}} onRequestAccess={vi.fn()} />);
    expect(screen.getByText(/сверьте сектор и код доступа/i)).toBeInTheDocument();
  });
});
