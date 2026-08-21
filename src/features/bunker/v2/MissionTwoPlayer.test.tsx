import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionTwoPlayer, type MissionTwoPlayerReadModel } from './MissionTwoPlayer';

const model: MissionTwoPlayerReadModel = {
  instanceId: 'm02', instanceVersion: 1, status: 'active', remainingSeconds: 300,
  title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ',
  intro: 'Чёрный ящик частично повреждён. Восстановлено шесть фрагментов записи. Только часть данных подлинна. Сопоставьте время, технические события и маршрут.',
  evidence: Array.from({ length: 6 }, (_, index) => ({ key: `e${index + 1}`, label: `Фрагмент ${index + 1}`, body: `Данные ${index + 1}` })),
  questions: [
    { key: 'wagon', prompt: 'Из какого вагона пришёл аварийный сигнал?', options: ['Вагон №2', 'Вагон №3', 'Вагон №4'] },
    { key: 'event', prompt: 'Какое действие произошло непосредственно перед сбоем?', options: ['Открытие технического шлюза', 'Отключение освещения', 'Запуск резервного питания'] },
    { key: 'evidence', prompt: 'Какой номер фрагмента подтверждает вывод?', options: ['03', '05', '06'] },
  ],
  attemptCount: 0, attemptsRemaining: 2, selectedAnswers: ['', '', ''], connection: 'online',
  ability: { available: true, key: 'terminal_hack', label: 'Работа со служебным терминалом', hint: 'Получить дополнительную техническую подсказку.' },
};

describe('MissionTwoPlayer', () => {
  it('shows the question before evidence controls and explains the task in plain Russian', () => {
    render(<MissionTwoPlayer model={model} onSubmit={vi.fn()} onUseAbility={vi.fn()} />);
    const question = screen.getByText('Из какого вагона пришёл аварийный сигнал?');
    const evidence = screen.getByRole('button', { name: /Фрагмент 1/i });
    expect(question.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/шесть фрагментов/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Фрагмент/i })).toHaveLength(6);
  });

  it('keeps one dominant submit action disabled until all three answers are selected', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<MissionTwoPlayer model={model} onSubmit={submit} onUseAbility={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'ПРОВЕРИТЬ ВЕРСИЮ' });
    expect(button).toBeDisabled();
    await user.click(screen.getByLabelText('Вагон №4'));
    await user.click(screen.getByLabelText('Открытие технического шлюза'));
    await user.click(screen.getByLabelText('05'));
    expect(button).toBeEnabled();
    await user.click(button);
    expect(submit).toHaveBeenCalledWith(['Вагон №4', 'Открытие технического шлюза', '05']);
  });

  it('explains retry count without technical terms and exposes ability only when available', () => {
    render(<MissionTwoPlayer model={{ ...model, attemptCount: 1, attemptsRemaining: 1 }} onSubmit={vi.fn()} onUseAbility={vi.fn()} />);
    expect(screen.getByText(/осталась 1 попытка/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /использовать способность/i })).toBeInTheDocument();
  });
});
