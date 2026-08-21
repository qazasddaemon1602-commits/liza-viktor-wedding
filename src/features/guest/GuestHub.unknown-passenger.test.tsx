import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RegisteredGuest } from '../registration/registration.types';
import { GuestHub } from './GuestHub';

const guest: RegisteredGuest = {
  id: 'guest-1', firstName: 'Анна', lastName: 'Петрова', affiliationType: 'common', affiliationDetail: '', ticketNumber: 'LV-001',
  carriage: { id: 'wagon-1', number: 1, label: 'ВАГОН №1', accentHex: '#333333', visualMark: 'I' },
};
const runtime = {
  contractVersion: 2 as const, status: 'active' as const, serverNow: '2026-08-30T19:00:00Z', state: 'UNKNOWN_PASSENGER' as const,
  planVersion: 1, runNonce: 'run', viewer: { kind: 'guest' as const, guest: { id: guest.id, realName: 'Анна Петрова' }, wagon: { number: 1, label: 'ВАГОН №1' } },
  character: { profileKey: 'architect', profileVersion: 1, profession: 'Архитектор', health: 'Здорова', visibleSkill: 'Анализ планов', specialAbility: 'plan_analysis', abilityDescription: 'Анализирует планы.', abilityUsesRemaining: 1, status: 'saved' as const, m01Eligibility: 'frozen_member' as const, hiddenTraitRevealed: false as const },
  currentMission: { instanceId: 'story', instanceVersion: 1, code: 'UNKNOWN_PASSENGER' as const, status: 'active' as const, scope: 'global' as const },
};
const story = { remainingSeconds: 60, title: 'Неизвестный пассажир', dossierId: 'BK-17', lead: 'Досье не совпадает со списком пассажиров.', sector: '04', accessCode: '4719', recoveredBy: 'archive_recovery' as const, storyPoints: ['Пассажира нет в списке.', 'Бункер существует.'] };

describe('GuestHub unknown passenger', () => {
  it('keeps the guest inside the Bunker and renders BK-17 as the only active story card', () => {
    render(<GuestHub guest={guest} activeCall={null} bunkerRuntime={runtime} bunkerUnknownPassenger={story} quizState={{ status: 'idle', history: [] }} onQuizVote={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Сюжет · Неизвестный пассажир' })).toBeInTheDocument();
    expect(screen.getByText(/4719/)).toBeInTheDocument();
    expect(screen.queryByTestId('virtual-ticket')).not.toBeInTheDocument();
  });
});
