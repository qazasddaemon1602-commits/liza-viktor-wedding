import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GuestCallBanner } from './GuestCallBanner';

const carriage = {
  id: 'c4',
  number: 4,
  label: 'ВАГОН №4',
  accentHex: '#78806A',
  visualMark: '04',
};

describe('GuestCallBanner', () => {
  it('shows the active message together with the guest carriage number and accent', () => {
    render(
      <GuestCallBanner
        carriage={carriage}
        call={{
          id: 'call-1',
          message: 'ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР',
          showOnScreen: false,
          createdAt: '2026-08-30T13:00:00+05:00',
        }}
      />,
    );

    expect(screen.getByText('ВЫЗОВ ВАГОНА')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №4')).toBeInTheDocument();
    expect(screen.getByText('ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР')).toBeInTheDocument();
    expect(screen.getByTestId('guest-call-banner')).toHaveStyle({ '--carriage-accent': '#78806A' });
  });

  it('renders nothing when the guest has no active call', () => {
    const { container } = render(<GuestCallBanner carriage={carriage} call={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
