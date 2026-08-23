import { describe, expect, it } from 'vitest';
import {
  parseEveningNominationsControl,
  parseEveningNominationsScreenEvent,
} from './eveningNominations.service';

describe('evening nominations service', () => {
  const nominations = [
    { key: 'first_passenger', title: 'ПЕРВЫЙ ПАССАЖИР', recipient: 'Анна П.', detail: 'БИЛЕТ №001' },
    { key: 'detective_wagon', title: 'ДЕТЕКТИВ BK-17', recipient: 'ВАГОН №2', detail: 'ПЕРВЫМ ЗАКРЫЛ «ЧЁРНЫЙ ЯЩИК»' },
  ];

  it('parses only fact-backed owner nominations', () => {
    expect(parseEveningNominationsControl({ status: 'ok', nominations })).toEqual({ status: 'ok', nominations });
  });

  it('parses the projector nominations event', () => {
    expect(parseEveningNominationsScreenEvent({
      id: 'event-1',
      kind: 'evening_nominations',
      created_at: '2026-08-24T00:00:00Z',
      payload: { nominations },
    })).toEqual({
      id: 'event-1',
      kind: 'evening_nominations',
      createdAt: '2026-08-24T00:00:00Z',
      nominations,
    });
  });
});
