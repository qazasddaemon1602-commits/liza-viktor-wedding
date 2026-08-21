import { describe, expect, it, vi } from 'vitest';
import {
  getGuestQuizState,
  submitGuestQuizVote,
  type QuizRpcClient,
} from './quiz.service';

function clientWith(data: unknown): QuizRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('guest quiz service', () => {
  it('loads the current question through the registered-device RPC without exposing raw votes', async () => {
    const client = clientWith({
      status: 'active',
      phase: 'voting',
      question: {
        id: 'question-1',
        text: 'Кто дольше собирается?',
        questionType: 'standard',
        imagePath: null,
      },
      selectedChoice: null,
      answeredCount: 17,
    });

    const result = await getGuestQuizState(client, 'liza-viktor', 'lvw_device_1234');

    expect(client.rpc).toHaveBeenCalledWith('get_quiz_state', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_1234',
    });
    expect(result).toEqual({
      status: 'active',
      phase: 'voting',
      question: {
        id: 'question-1',
        text: 'Кто дольше собирается?',
        questionType: 'standard',
        imagePath: null,
      },
      selectedChoice: null,
      answeredCount: 17,
    });
    expect('results' in result).toBe(false);
  });

  it('submits exactly one liza/viktor choice through the vote RPC', async () => {
    const client = clientWith({ status: 'accepted', choice: 'viktor' });

    const result = await submitGuestQuizVote(
      client,
      'liza-viktor',
      'lvw_device_1234',
      'question-1',
      'viktor',
    );

    expect(client.rpc).toHaveBeenCalledWith('submit_quiz_vote', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_1234',
      p_question_id: 'question-1',
      p_choice: 'viktor',
    });
    expect(result).toEqual({ status: 'accepted', choice: 'viktor' });
  });

  it('parses aggregate results only after the server reports results phase', async () => {
    const client = clientWith({
      status: 'active',
      phase: 'results',
      question: {
        id: 'question-1',
        text: 'Кто дольше собирается?',
        questionType: 'standard',
        imagePath: null,
      },
      selectedChoice: 'liza',
      answeredCount: 30,
      results: { liza: 18, viktor: 12, total: 30 },
    });

    const result = await getGuestQuizState(client, 'liza-viktor', 'lvw_device_1234');

    expect(result.status).toBe('active');
    if (result.status === 'active' && result.phase === 'results') {
      expect(result.results).toEqual({ liza: 18, viktor: 12, total: 30 });
    }
  });
});
