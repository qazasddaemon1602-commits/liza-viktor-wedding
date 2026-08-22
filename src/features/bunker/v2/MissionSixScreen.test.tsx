import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissionSixScreen } from './MissionSixScreen';

describe('MissionSixScreen', () => {
  it('shows only fragment and consensus progress, never the secret code', () => {
    render(<MissionSixScreen model={{ title: 'Общий протокол', remainingSeconds: 420, fragmentsRevealed: 2, fragmentsTotal: 4, wagons: [{ wagonId:'w1', label:'ВАГОН №1', consensusReady:true }, { wagonId:'w2', label:'ВАГОН №2', consensusReady:false }] }} />);
    expect(screen.getByText('2 / 4 ФРАГМЕНТА')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 ВАГОНОВ СОГЛАСОВАЛИ')).toBeInTheDocument();
    expect(screen.queryByText('4719')).not.toBeInTheDocument();
    expect(screen.queryByText('SECTOR 04')).not.toBeInTheDocument();
  });
});
