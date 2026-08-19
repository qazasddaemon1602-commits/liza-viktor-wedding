import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RegistrationPage } from './RegistrationPage';

const registeredGuest = {
  id: 'guest-31',
  firstName: 'Иван',
  lastName: 'Петров',
  affiliationType: 'viktor',
  affiliationDetail: 'коллега Виктора',
  ticketNumber: 'LV-031',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#7E3F3C',
    visualMark: '03',
  },
};

describe('RegistrationPage', () => {
  it('shows required-field errors before registration', async () => {
    const user = userEvent.setup();
    render(<RegistrationPage onRegister={vi.fn()} revealDelayMs={0} />);

    await user.click(screen.getByRole('button', { name: /получить билет/i }));

    expect(screen.getByText('Введите имя')).toBeInTheDocument();
    expect(screen.getByText('Введите фамилию')).toBeInTheDocument();
    expect(screen.getByText('Выберите, с кем вы сегодня')).toBeInTheDocument();
  });

  it('registers a guest and reveals the assigned virtual ticket', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn().mockResolvedValue(registeredGuest);
    render(<RegistrationPage onRegister={onRegister} revealDelayMs={0} />);

    await user.type(screen.getByLabelText('Имя'), '  Иван  ');
    await user.type(screen.getByLabelText('Фамилия'), ' Петров ');
    await user.selectOptions(screen.getByLabelText('С кем вы сегодня?'), 'viktor');
    await user.type(screen.getByLabelText('Уточнение'), '  коллега   Виктора ');
    await user.click(screen.getByRole('button', { name: /получить билет/i }));

    expect(onRegister).toHaveBeenCalledWith({
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'viktor',
      affiliationDetail: 'коллега Виктора',
    });
    expect(await screen.findByText('ВАГОН №3')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
  });

  it('opens the existing ticket immediately for a restored guest', () => {
    render(
      <RegistrationPage
        onRegister={vi.fn()}
        initialGuest={registeredGuest}
        revealDelayMs={0}
      />,
    );

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-ticket-stub')).toBeInTheDocument();
    expect(screen.getByText('PASSENGER')).toBeInTheDocument();
    expect(screen.getByText('VALID · 30 AUG 2026')).toBeInTheDocument();
    expect(screen.getByTestId('wedding-railway-emblem')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /получить билет/i })).not.toBeInTheDocument();
  });

  it('asks for confirmation when the same name is already registered on another device', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn()
      .mockResolvedValueOnce({ status: 'duplicate_warning', publicName: 'Иван П.' })
      .mockResolvedValueOnce(registeredGuest);

    render(<RegistrationPage onRegister={onRegister} revealDelayMs={0} />);

    await user.type(screen.getByLabelText('Имя'), 'Иван');
    await user.type(screen.getByLabelText('Фамилия'), 'Петров');
    await user.selectOptions(screen.getByLabelText('С кем вы сегодня?'), 'common');
    await user.click(screen.getByRole('button', { name: /получить билет/i }));

    expect(await screen.findByText(/Иван П\. уже зарегистрирован/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ЭТО ДРУГОЙ ЧЕЛОВЕК' }));

    expect(onRegister).toHaveBeenLastCalledWith({
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'common',
      affiliationDetail: '',
    }, true);
    expect(await screen.findByText('LV-031')).toBeInTheDocument();
  });
});
