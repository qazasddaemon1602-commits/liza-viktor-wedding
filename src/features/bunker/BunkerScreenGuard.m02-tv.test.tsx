import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard } from './BunkerScreenGuard';

async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); }
const base = { status: 'active' as const, startedAt: '2026-08-30T18:10:00.000Z', durationSeconds: 1800, remainingSeconds: 1200, soundEnabled: false, phase: 'dossier_2' as const, unlocked: false, teams: [], characterCounts: { active: 15, saved: 12, excluded: 3 }, globalGameState: 'MISSION_02' as const, currentMission: { id: 'm02', state: 'MISSION_02', plan: null }, serverNow: '2026-08-30T18:10:00.000Z' };
const m02 = { contractVersion: 2 as const, status: 'active' as const, serverNow: base.serverNow, deadlineAt: '2026-08-30T18:15:00.000Z', title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ', wagons: [{ wagonId: '1', label: 'ВАГОН №1', status: 'active' as const, attemptCount: 0 }] };

describe('BunkerScreenGuard · M02 TV', () => {
  it('renders the dedicated M02 scene from the public projection', async () => {
    render(<BunkerScreenGuard dependencies={{ load: vi.fn().mockResolvedValue(base), loadMissionTwo: vi.fn().mockResolvedValue(m02) }}><div>ОБЫЧНЫЙ ЭКРАН</div></BunkerScreenGuard>);
    await flush();
    expect(screen.getByRole('region', { name: 'Задание 2 · общий экран' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ЧЁРНЫЙ ЯЩИК' })).toBeInTheDocument();
  });

  it('does not fall back to legacy dossier copy while M02 projection reconnects', async () => {
    render(<BunkerScreenGuard dependencies={{ load: vi.fn().mockResolvedValue(base), loadMissionTwo: vi.fn().mockRejectedValue(new Error('offline')) }}><div>ОБЫЧНЫЙ ЭКРАН</div></BunkerScreenGuard>);
    await flush();
    expect(screen.getByRole('region', { name: 'Задание 2 · общий экран' })).toHaveTextContent(/ЧЁРНЫЙ ЯЩИК.*ЗАГРУЖАЕМ/i);
    expect(screen.queryByText('ДОСЬЕ РАСКРЫТО')).not.toBeInTheDocument();
  });
});
