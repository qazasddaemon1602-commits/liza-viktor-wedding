import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JoinPage, type JoinPageDependencies } from './JoinPage';

const guest = {
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

function dependencies(overrides: Partial<JoinPageDependencies> = {}): JoinPageDependencies {
  return {
    getDeviceKey: () => 'lvw_device_1',
    restore: vi.fn().mockResolvedValue({ status: 'not_found' }),
    register: vi.fn(),
    ...overrides,
  };
}

describe('JoinPage', () => {
  it('restores the existing guest from the same device and opens their ticket', async () => {
    const restore = vi.fn().mockResolvedValue({ status: 'restored', guest });
    render(<JoinPage dependencies={dependencies({ restore })} />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(restore).toHaveBeenCalledWith('lvw_device_1');
  });

  it('shows registration when the device has no existing guest binding', async () => {
    render(<JoinPage dependencies={dependencies()} />);

    expect(await screen.findByRole('button', { name: /получить билет/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toBeInTheDocument();
  });
});
