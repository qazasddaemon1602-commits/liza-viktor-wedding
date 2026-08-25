import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MissionTwoPlayer, type MissionTwoPlayerReadModel } from './MissionTwoPlayer';

const model: MissionTwoPlayerReadModel = {
  instanceId: 'm02', instanceVersion: 1, status: 'active', remainingSeconds: 300,
  title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ',
  intro: 'Чёрный ящик частично повреждён. Восстановлено шесть фрагментов записи.',
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
  it('shows one question at a time, advances after a confirmed answer, and keeps the evidence in a hint drawer', async () => {
    const user = userEvent.setup();
    render(<MissionTwoPlayer model={model} onSubmit={vi.fn()} onUseAbility={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Из какого вагона пришёл аварийный сигнал?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Какое действие произошло непосредственно перед сбоем?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Подсказки из чёрного ящика' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Открыть подсказки' }));
    expect(screen.getByRole('region', { name: 'Подсказки из чёрного ящика' })).toHaveTextContent('Данные 1');

    await user.click(screen.getByLabelText('Вагон №4'));
    await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    expect(screen.getByRole('heading', { name: 'Какое действие произошло непосредственно перед сбоем?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Из какого вагона пришёл аварийный сигнал?' })).not.toBeInTheDocument();
  });

  it('keeps the archive recovery visible and sends the existing three-answer payload only after sequential confirmation', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<MissionTwoPlayer model={{ ...model, archiveUnlocked: 'BK-17' }} onSubmit={submit} />);

    expect(screen.getByRole('status', { name: 'Архив вагона' })).toHaveTextContent('BK-17');
    await user.click(screen.getByLabelText('Вагон №4'));
    await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    await user.click(screen.getByLabelText('Открытие технического шлюза'));
    await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    await user.click(screen.getByLabelText('05'));
    await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    await user.click(screen.getByRole('button', { name: 'ПРОВЕРИТЬ ВЕРСИЮ' }));

    expect(submit).toHaveBeenCalledWith(['Вагон №4', 'Открытие технического шлюза', '05']);
    const extras = screen.getByText('ДОПОЛНИТЕЛЬНО').closest('details');
    expect(extras).not.toBeNull();
    expect(extras).not.toHaveAttribute('open');
    expect(within(extras as HTMLElement).getByRole('button', { name: /использовать способность/i })).not.toBeVisible();
    expect(within(extras as HTMLElement).getByText(/осталось попыток: 2/i)).not.toBeVisible();
  });

  it('restarts guided editing at question one after a wrong first attempt and submits changed answers', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    const firstAnswers = ['Вагон №4', 'Открытие технического шлюза', '05'];
    const view = render(<MissionTwoPlayer model={model} onSubmit={submit} />);

    for (const answer of firstAnswers) {
      await user.click(screen.getByLabelText(answer));
      await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    }
    await user.click(screen.getByRole('button', { name: 'ПРОВЕРИТЬ ВЕРСИЮ' }));

    view.rerender(
      <MissionTwoPlayer
        model={{ ...model, attemptCount: 1, attemptsRemaining: 1, selectedAnswers: firstAnswers }}
        onSubmit={submit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Из какого вагона пришёл аварийный сигнал?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Вагон №4')).toBeChecked();
    expect(screen.getByText(/предыдущая версия не подошла/i)).toBeInTheDocument();

    for (const answer of ['Вагон №2', 'Отключение освещения', '06']) {
      await user.click(screen.getByLabelText(answer));
      await user.click(screen.getByRole('button', { name: 'Подтвердить ответ' }));
    }
    await user.click(screen.getByRole('button', { name: 'ПРОВЕРИТЬ ВЕРСИЮ' }));

    expect(submit).toHaveBeenLastCalledWith(['Вагон №2', 'Отключение освещения', '06']);
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
