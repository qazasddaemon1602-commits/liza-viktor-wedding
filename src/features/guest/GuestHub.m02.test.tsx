import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RegisteredGuest } from '../registration/registration.types';
import { GuestHub } from './GuestHub';

const guest: RegisteredGuest = {
  id: 'guest-1', firstName: 'Анна', lastName: 'Петрова', affiliationType: 'common', affiliationDetail: '', ticketNumber: 'LV-001',
  carriage: { id: 'wagon-1', number: 1, label: 'ВАГОН №1', accentHex: '#333333', visualMark: 'I' },
};

const runtime = {
  contractVersion: 2 as const, status: 'active' as const, serverNow: '2026-08-30T18:10:00.000Z', state: 'MISSION_02' as const,
  planVersion: 1, runNonce: '52000000-0000-4000-8000-000000000001',
  viewer: { kind: 'guest' as const, guest: { id: guest.id, realName: 'Анна Петрова' }, wagon: { number: 1, label: 'ВАГОН №1' } },
  character: { profileKey: 'programmer', profileVersion: 1, profession: 'Программист', health: 'Здорова', visibleSkill: 'Разбирается в системах', specialAbility: 'system_access', abilityDescription: 'Служебный доступ', abilityUsesRemaining: 1, status: 'saved' as const, m01Eligibility: 'frozen_member' as const, hiddenTraitRevealed: true as const, hiddenTrait: 'Не любит высоту' },
  currentMission: { instanceId: '52000000-0000-4000-8000-000000000010', instanceVersion: 1, code: 'MISSION_02' as const, status: 'active' as const, scope: 'wagon' as const },
};

const missionTwo = {
  instanceId: runtime.currentMission.instanceId, instanceVersion: 1, status: 'active' as const, remainingSeconds: 300,
  title: 'Чёрный ящик', subtitle: 'ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ', intro: 'Восстановлено шесть фрагментов.',
  evidence: Array.from({ length: 6 }, (_, index) => ({ key: `e${index}`, label: `Фрагмент ${index + 1}`, body: `Данные ${index + 1}` })),
  questions: [
    { key: 'wagon', prompt: 'Из какого вагона пришёл аварийный сигнал?', options: ['Вагон №2','Вагон №3','Вагон №4'] },
    { key: 'event', prompt: 'Что произошло?', options: ['Шлюз','Свет','Питание'] },
    { key: 'fragment', prompt: 'Какой фрагмент?', options: ['03','05','06'] },
  ],
  attemptCount: 0, attemptsRemaining: 2, selectedAnswers: ['', '', ''], connection: 'online' as const, ability: null,
};

describe('GuestHub · M02', () => {
  it('keeps a V2 guest inside the Bunker and renders the current black-box mission', () => {
    render(<GuestHub guest={guest} activeCall={null} bunkerRuntime={runtime} bunkerMissionTwo={missionTwo} quizState={{ status: 'idle', history: [] }} onQuizVote={vi.fn()} />);
    expect(screen.getByLabelText('Игровой модуль Бункер')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Задание 2 · Чёрный ящик' })).toBeInTheDocument();
    expect(screen.queryByTestId('virtual-ticket')).not.toBeInTheDocument();
  });
});
