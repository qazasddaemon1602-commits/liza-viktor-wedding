import { describe, expect, it, vi } from 'vitest';
import {
  getQuizScreenState,
  type QuizScreenRpcClient,
} from './quizScreen.service';

function client(data: unknown): QuizScreenRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('getQuizScreenState', () => {
  it('parses an active voting state without any result split', async () => {
    const rpcClient = client({
      status: 'active',
      phase: 'voting',
      question: {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard',
        imagePath: null,
      },
      answeredCount: 17,
    });

    await expect(getQuizScreenState(rpcClient, 'liza-viktor')).resolves.toEqual({
      status: 'active',
      phase: 'voting',
      question: {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard',
        imagePath: null,
      },
      answeredCount: 17,
    });
    expect(rpcClient.rpc).toHaveBeenCalledWith('get_quiz_screen_state', {
      p_event_slug: 'liza-viktor',
    });
  });

  it('parses aggregate results only after the server returns results phase', async () => {
    const rpcClient = client({
      status: 'active',
      phase: 'results',
      question: {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard',
        imagePath: '/quiz/chief.webp',
      },
      answeredCount: 30,
      results: { liza: 18, viktor: 12, total: 30 },
    });

    await expect(getQuizScreenState(rpcClient, 'liza-viktor')).resolves.toEqual({
      status: 'active',
      phase: 'results',
      question: {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard',
        imagePath: '/quiz/chief.webp',
      },
      answeredCount: 30,
      results: { liza: 18, viktor: 12, total: 30 },
    });
  });

  it.each([
    [{ status: 'idle' }, { status: 'idle' }],
    [{ status: 'not_found' }, { status: 'not_found' }],
  ])('parses non-active projector states', async (raw, expected) => {
    await expect(getQuizScreenState(client(raw), 'liza-viktor')).resolves.toEqual(expected);
  });

  it('rejects a voting payload that tries to smuggle results before reveal', async () => {
    const rpcClient = client({
      status: 'active',
      phase: 'voting',
      question: {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard',
        imagePath: null,
      },
      answeredCount: 17,
      results: { liza: 10, viktor: 7, total: 17 },
    });

    await expect(getQuizScreenState(rpcClient, 'liza-viktor')).rejects.toThrow(
      'Unexpected projector quiz-state response',
    );
  });
});
