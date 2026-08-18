import { describe, expect, it, vi } from 'vitest';
import {
  getOwnerCoupleRevealStatus,
  getRevealedCoupleAnswer,
  revealOwnerCoupleAnswer,
  type CoupleRevealRpcClient,
} from './coupleReveal.service';

function clientWith(data: unknown): CoupleRevealRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

describe('couple answer reveal service', () => {
  it('loads owner readiness without returning the hidden choice', async () => {
    const client = clientWith({ status: 'ready', revealed: false });

    const result = await getOwnerCoupleRevealStatus(client, 'event-1', 'question-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_couple_reveal_status', {
      p_event_id: 'event-1',
      p_question_id: 'question-1',
    });
    expect(result).toEqual({ status: 'ready', revealed: false });
    expect(JSON.stringify(result)).not.toMatch(/choice|liza|viktor/i);
  });

  it('performs the owner second reveal without receiving the answer value', async () => {
    const client = clientWith({ status: 'revealed', questionId: 'question-1' });

    const result = await revealOwnerCoupleAnswer(client, 'event-1', 'question-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_reveal_couple_preanswer', {
      p_event_id: 'event-1',
      p_question_id: 'question-1',
    });
    expect(result).toEqual({ status: 'revealed', questionId: 'question-1' });
  });

  it('keeps the public answer hidden before the owner second reveal', async () => {
    const client = clientWith({ status: 'hidden' });

    await expect(getRevealedCoupleAnswer(client, 'liza-viktor')).resolves.toEqual({ status: 'hidden' });
    expect(client.rpc).toHaveBeenCalledWith('get_revealed_couple_answer', {
      p_event_slug: 'liza-viktor',
    });
  });

  it('parses only liza or viktor after the answer is explicitly revealed', async () => {
    await expect(getRevealedCoupleAnswer(clientWith({
      status: 'revealed',
      questionId: 'question-1',
      choice: 'liza',
    }), 'liza-viktor')).resolves.toEqual({
      status: 'revealed',
      questionId: 'question-1',
      choice: 'liza',
    });

    await expect(getRevealedCoupleAnswer(clientWith({
      status: 'revealed',
      questionId: 'question-1',
      choice: 'other',
    }), 'liza-viktor')).rejects.toThrow('Unexpected couple reveal response');
  });
});
