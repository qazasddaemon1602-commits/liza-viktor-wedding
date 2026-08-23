import { describe, expect, it } from 'vitest';
import {
  parseCapsuleShowcaseScreenEvent,
  parseGuestMessageCapsuleState,
  parseOwnerMessageCapsuleControl,
  parseSaveGuestMessageResult,
} from './messageCapsule.service';

describe('message capsule service contract', () => {
  it('parses a guest capsule state with an editable saved message', () => {
    expect(parseGuestMessageCapsuleState({
      status: 'ready',
      open: true,
      maxLength: 280,
      message: 'Будьте счастливы!',
      updatedAt: '2026-08-24T00:00:00Z',
    })).toEqual({
      status: 'ready',
      open: true,
      maxLength: 280,
      message: 'Будьте счастливы!',
      updatedAt: '2026-08-24T00:00:00Z',
    });
  });

  it('parses a saved guest message result', () => {
    expect(parseSaveGuestMessageResult({
      status: 'saved',
      message: 'Любви!',
      updatedAt: '2026-08-24T00:01:00Z',
    })).toEqual({
      status: 'saved',
      message: 'Любви!',
      updatedAt: '2026-08-24T00:01:00Z',
    });
  });

  it('parses owner control with named authors', () => {
    const control = parseOwnerMessageCapsuleControl({
      status: 'ok',
      open: true,
      count: 1,
      messages: [{
        guestId: 'g1',
        displayName: 'Анна П.',
        carriage: 'ВАГОН №2',
        message: 'Счастья!',
        updatedAt: '2026-08-24T00:02:00Z',
      }],
    });
    expect(control.status).toBe('ok');
    if (control.status === 'ok') {
      expect(control.messages[0]?.displayName).toBe('Анна П.');
      expect(control.count).toBe(1);
    }
  });

  it('parses a capsule showcase for the projector', () => {
    expect(parseCapsuleShowcaseScreenEvent({
      id: 'screen-1',
      kind: 'capsule_showcase',
      created_at: '2026-08-24T00:03:00Z',
      payload: {
        messages: [{ displayName: 'Анна П.', carriage: 'ВАГОН №2', message: 'Счастья!' }],
      },
    })).toEqual({
      id: 'screen-1',
      kind: 'capsule_showcase',
      createdAt: '2026-08-24T00:03:00Z',
      messages: [{ displayName: 'Анна П.', carriage: 'ВАГОН №2', message: 'Счастья!' }],
    });
  });
});
