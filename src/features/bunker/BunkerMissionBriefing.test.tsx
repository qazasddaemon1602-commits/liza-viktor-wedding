import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getBunkerMissionContent } from './v2/content/missionContent';
import { BunkerMissionBriefing } from './BunkerMissionBriefing';

describe('BunkerMissionBriefing', () => {
  it('turns an authoritative mission into a clear player briefing', () => {
    const content = getBunkerMissionContent('MISSION_03');
    if (!content) throw new Error('MISSION_03 fixture is missing');

    render(<BunkerMissionBriefing content={content} />);

    const briefing = screen.getByRole('region', { name: 'Описание текущего задания' });
    expect(within(briefing).getByRole('heading', { name: 'Аварийный запас' })).toBeInTheDocument();
    expect(within(briefing).getByRole('heading', { name: 'ЧТО ПРОИСХОДИТ' })).toBeInTheDocument();
    expect(within(briefing).getByRole('heading', { name: 'ВАША ЦЕЛЬ' })).toBeInTheDocument();
    expect(within(briefing).getByRole('heading', { name: 'ЧТО ДЕЛАТЬ' })).toBeInTheDocument();
    expect(within(briefing).getByText(/ресурсов хватит, чтобы закрыть не больше трёх/i)).toBeInTheDocument();
    expect(within(briefing).getByText('Генератор')).toBeInTheDocument();
    expect(within(briefing).getByText(/сохраняет время в финальном протоколе/i)).toBeInTheDocument();
    expect(within(briefing).getByRole('heading', { name: 'ЧТО ИЗМЕНИТСЯ' })).toBeInTheDocument();
  });

  it('shows the assigned M04 wagon group without exposing wagon ids', () => {
    const content = getBunkerMissionContent('MISSION_04');
    if (!content) throw new Error('MISSION_04 fixture is missing');
    render(
      <BunkerMissionBriefing
        content={content}
        missionAction={{
          missionState: 'MISSION_04', completed: false, completedAt: null, submittedPayload: null,
          requirements: {
            groupWagons: [
              { id: 'wagon-private-a', number: 1, label: 'ВАГОН №1' },
              { id: 'wagon-private-b', number: 3, label: 'ВАГОН №3' },
            ],
          },
        }}
        showConsequences={false}
      />,
    );
    expect(screen.getByText('Ваша группа связи: ВАГОН №1 · ВАГОН №3.')).toBeInTheDocument();
    expect(screen.queryByText(/wagon-private/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ЧТО ИЗМЕНИТСЯ' })).not.toBeInTheDocument();
  });

  it('shows the earned M06 fragment and required human wagon labels', () => {
    const content = getBunkerMissionContent('MISSION_06');
    if (!content) throw new Error('MISSION_06 fixture is missing');
    render(
      <BunkerMissionBriefing
        content={content}
        missionAction={{
          missionState: 'MISSION_06', completed: true,
          completedAt: '2026-08-20T18:00:00.000Z', submittedPayload: { protocolConfirmed: true },
          requirements: {
            requiredWagons: [{ id: 'wagon-private-c', number: 2, label: 'ВАГОН №2' }],
            rewardFragment: 'СЕКТОР-04',
          },
        }}
      />,
    );
    expect(screen.getByText('Сверьте протокол с вагонами: ВАГОН №2.')).toBeInTheDocument();
    expect(screen.getByText('Ваш фрагмент протокола: СЕКТОР-04.')).toBeInTheDocument();
    expect(screen.queryByText(/wagon-private/)).not.toBeInTheDocument();
  });
});
