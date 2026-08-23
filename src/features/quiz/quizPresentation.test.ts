import { describe, expect, it } from 'vitest';
import { quizAnnouncementKey, quizPresentationKey } from './quizPresentation';

describe('quiz presentation identity', () => {
  it('keys each presented phase by question and phase', () => {
    expect(quizPresentationKey('q1', 'voting')).toBe('q1:voting');
    expect(quizPresentationKey('q1', 'results')).toBe('q1:results');
  });

  it('keys announcements by question, phase, and status', () => {
    expect(quizAnnouncementKey('q1', 'voting', 'accepted')).toBe('q1:voting:accepted');
  });
});
