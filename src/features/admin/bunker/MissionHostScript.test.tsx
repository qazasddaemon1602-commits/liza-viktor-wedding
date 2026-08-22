import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissionHostScript } from './MissionHostScript';
import { bunkerMissionContent } from '../../bunker/v2/missionContent';

describe('MissionHostScript', () => {
  it('renders the host scenario for the current mission', () => {
    const content = bunkerMissionContent('M01');
    if (!content) throw new Error('M01 content missing');
    render(<MissionHostScript content={content} statusLine="Задание идёт сейчас" />);

    expect(screen.getByRole('heading', { name: /МИССИЯ 01 · Лишний пассажир/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ЧТО ПРОИСХОДИТ ПО СЮЖЕТУ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ТЕКСТ ВЕДУЩЕГО' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ЕСЛИ ГОСТИ ЗАСТРЯЛИ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ПОСЛЕ ЗАВЕРШЕНИЯ' })).toBeTruthy();
    expect(screen.getByText('Задание идёт сейчас')).toBeTruthy();
    expect(screen.getByText(content.host.say[0])).toBeTruthy();
  });
});
