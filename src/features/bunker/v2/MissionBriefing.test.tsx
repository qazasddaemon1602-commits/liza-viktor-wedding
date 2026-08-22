import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissionBriefing } from './MissionBriefing';
import { bunkerMissionContent } from './missionContent';

describe('MissionBriefing', () => {
  it('shows the four guest blocks before the mechanics', () => {
    const content = bunkerMissionContent('M01');
    if (!content) throw new Error('M01 content missing');
    render(<MissionBriefing content={content} />);

    expect(screen.getByRole('heading', { name: 'ЧТО ПРОИСХОДИТ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ВАША ЦЕЛЬ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ЧТО ДЕЛАТЬ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ИСПОЛЬЗУЕТСЯ В ЗАДАНИИ' })).toBeTruthy();
    expect(screen.getByText(content.goal)).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(
      content.steps.length + content.items.length,
    );
  });
});
