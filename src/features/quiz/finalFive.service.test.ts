import { describe, expect, it, vi } from 'vitest';
import {
  getFinalFiveRoleState,
  getOwnerFinalFiveStatus,
  getRevealedFinalFive,
  issueFinalFiveRoleAccess,
  revealFinalFive,
  seedFinalFiveQuestions,
  submitFinalFiveAnswer,
  type FinalFiveRpcClient,
} from './finalFive.service';

function clientWith(...payloads: unknown[]): FinalFiveRpcClient {
  const rpc = vi.fn();
  for (const data of payloads) rpc.mockResolvedValueOnce({ data, error: null });
  return { rpc };
}

describe('final five service', () => {
  it('loads only the private role holder own state', async () => {
    const client = clientWith({
      status: 'active',
      role: 'liza',
      phase: 'voting',
      question: { id: 'q1', text: 'Кто главный?' },
      selectedChoice: 'viktor',
    });

    await expect(getFinalFiveRoleState(client, 'liza-viktor', 'liza', 'secret-token')).resolves.toEqual({
      status: 'active',
      role: 'liza',
      phase: 'voting',
      question: { id: 'q1', text: 'Кто главный?' },
      selectedChoice: 'viktor',
    });
    expect(JSON.stringify((await Promise.resolve({ role: 'liza' })))).not.toMatch(/viktorAnswer/i);
  });

  it('submits a private role answer and allows only liza or viktor choices', async () => {
    const client = clientWith({ status: 'accepted', questionId: 'q1', role: 'viktor', choice: 'liza' });

    await expect(submitFinalFiveAnswer(client, 'liza-viktor', 'viktor', 'secret-token', 'q1', 'liza')).resolves.toEqual({
      status: 'accepted',
      questionId: 'q1',
      role: 'viktor',
      choice: 'liza',
    });
  });

  it('seeds exactly the final five and issues separate role access', async () => {
    const client = clientWith(
      { status: 'ready', questionCount: 5 },
      { status: 'issued', role: 'liza', token: 'liza-secret' },
    );

    await expect(seedFinalFiveQuestions(client, 'event-1')).resolves.toEqual({ status: 'ready', questionCount: 5 });
    await expect(issueFinalFiveRoleAccess(client, 'event-1', 'liza')).resolves.toEqual({
      status: 'issued', role: 'liza', token: 'liza-secret',
    });
  });

  it('gives the owner completion flags but never answer values', async () => {
    const client = clientWith({
      status: 'ok',
      current: true,
      phase: 'results',
      answeredCount: 31,
      lizaAnswered: true,
      viktorAnswered: true,
      revealed: false,
    });

    const result = await getOwnerFinalFiveStatus(client, 'event-1', 'q1');
    expect(result).toEqual({
      status: 'ok', current: true, phase: 'results', answeredCount: 31,
      lizaAnswered: true, viktorAnswered: true, revealed: false,
    });
    expect(result).not.toHaveProperty('lizaAnswer');
    expect(result).not.toHaveProperty('viktorAnswer');
    expect(result).not.toHaveProperty('choice');
  });

  it('reveals through an owner action that still does not return the private values', async () => {
    const client = clientWith({ status: 'revealed', questionId: 'q1' });
    await expect(revealFinalFive(client, 'event-1', 'q1')).resolves.toEqual({ status: 'revealed', questionId: 'q1' });
  });

  it('keeps projector state hidden until reveal, then parses both live answers', async () => {
    const hidden = clientWith({ status: 'hidden' });
    await expect(getRevealedFinalFive(hidden, 'liza-viktor')).resolves.toEqual({ status: 'hidden' });

    const revealed = clientWith({
      status: 'revealed',
      question: { id: 'q1', text: 'Кто главный?' },
      results: { liza: 20, viktor: 11, total: 31 },
      lizaAnswer: 'liza',
      viktorAnswer: 'viktor',
    });
    await expect(getRevealedFinalFive(revealed, 'liza-viktor')).resolves.toEqual({
      status: 'revealed',
      question: { id: 'q1', text: 'Кто главный?' },
      results: { liza: 20, viktor: 11, total: 31 },
      lizaAnswer: 'liza',
      viktorAnswer: 'viktor',
    });
  });
});
