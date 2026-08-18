import { describe, expect, it, vi } from 'vitest';
import {
  finalizeCouplePreanswers,
  getCouplePreanswerForm,
  saveCouplePreanswer,
  type CouplePreanswerRpcClient,
} from './couplePreanswers.service';

function client(data: unknown): CouplePreanswerRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('couple preanswer service', () => {
  it('loads the editable joint form with saved choices', async () => {
    const rpcClient = client({
      status: 'active',
      eventId: 'event-1',
      answeredCount: 1,
      totalCount: 2,
      questions: [
        {
          id: 'q1',
          text: 'Кто в доме главный?',
          sortOrder: 1,
          imagePath: null,
          choice: 'viktor',
        },
        {
          id: 'q2',
          text: 'Кто первым мирится?',
          sortOrder: 2,
          imagePath: '/quiz/peace.webp',
          choice: null,
        },
      ],
    });

    await expect(getCouplePreanswerForm(rpcClient, 'liza-viktor', 'secret-token')).resolves.toEqual({
      status: 'active',
      eventId: 'event-1',
      answeredCount: 1,
      totalCount: 2,
      questions: [
        {
          id: 'q1',
          text: 'Кто в доме главный?',
          sortOrder: 1,
          imagePath: null,
          choice: 'viktor',
        },
        {
          id: 'q2',
          text: 'Кто первым мирится?',
          sortOrder: 2,
          imagePath: '/quiz/peace.webp',
          choice: null,
        },
      ],
    });
    expect(rpcClient.rpc).toHaveBeenCalledWith('get_couple_preanswer_form', {
      p_event_slug: 'liza-viktor',
      p_token: 'secret-token',
    });
  });

  it('parses the consumed finished state without exposing old answers', async () => {
    await expect(getCouplePreanswerForm(client({ status: 'finished' }), 'liza-viktor', 'secret')).resolves.toEqual({
      status: 'finished',
    });
  });

  it('saves one joint choice', async () => {
    const rpcClient = client({ status: 'saved', questionId: 'q1', choice: 'liza' });

    await expect(saveCouplePreanswer(rpcClient, 'liza-viktor', 'secret', 'q1', 'liza')).resolves.toEqual({
      status: 'saved',
      questionId: 'q1',
      choice: 'liza',
    });
    expect(rpcClient.rpc).toHaveBeenCalledWith('save_couple_preanswer', {
      p_event_slug: 'liza-viktor',
      p_token: 'secret',
      p_question_id: 'q1',
      p_choice: 'liza',
    });
  });

  it('finalizes the complete batch and accepts already-finished idempotency', async () => {
    await expect(finalizeCouplePreanswers(client({ status: 'finalized', answerCount: 30 }), 'liza-viktor', 'secret')).resolves.toEqual({
      status: 'finalized',
      answerCount: 30,
    });
    await expect(finalizeCouplePreanswers(client({ status: 'finished' }), 'liza-viktor', 'secret')).resolves.toEqual({
      status: 'finished',
    });
  });

  it('rejects an active payload with an invalid choice instead of trusting malformed hidden-answer data', async () => {
    await expect(getCouplePreanswerForm(client({
      status: 'active',
      eventId: 'event-1',
      answeredCount: 1,
      totalCount: 1,
      questions: [
        { id: 'q1', text: 'Кто главный?', sortOrder: 1, imagePath: null, choice: 'both' },
      ],
    }), 'liza-viktor', 'secret')).rejects.toThrow('Unexpected couple preanswer response');
  });
});
