import { describe, expect, it } from 'vitest';
import {
  formatPublicGuestName,
  formatTicketNumber,
  normalizeRegistration,
  validateRegistration,
} from './registrationModel';

describe('registration model', () => {
  it('requires first name, last name and affiliation', () => {
    expect(validateRegistration({
      firstName: ' ',
      lastName: '',
      affiliationType: '',
      affiliationDetail: '',
    })).toEqual({
      firstName: 'Введите имя',
      lastName: 'Введите фамилию',
      affiliationType: 'Выберите, с кем вы сегодня',
    });
  });

  it('normalizes surrounding and repeated whitespace', () => {
    expect(normalizeRegistration({
      firstName: '  Иван  ',
      lastName: ' Петров   Сидоров ',
      affiliationType: 'viktor',
      affiliationDetail: '  коллега   Виктора  ',
    })).toEqual({
      firstName: 'Иван',
      lastName: 'Петров Сидоров',
      affiliationType: 'viktor',
      affiliationDetail: 'коллега Виктора',
    });
  });

  it('abbreviates surname on public screens', () => {
    expect(formatPublicGuestName('Иван', 'Петров')).toBe('Иван П.');
    expect(formatPublicGuestName('Лиза', '')).toBe('Лиза');
  });

  it('formats presentation ticket numbers consistently', () => {
    expect(formatTicketNumber(1)).toBe('LV-001');
    expect(formatTicketNumber(31)).toBe('LV-031');
    expect(formatTicketNumber(1042)).toBe('LV-1042');
  });
});
