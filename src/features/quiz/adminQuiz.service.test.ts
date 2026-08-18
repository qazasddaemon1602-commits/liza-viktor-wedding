import { describe, expect, it, vi } from 'vitest';
import {
  activateOwnerQuizQuestion,
  getOwnerQuizControl,
  revealOwnerQuizResults,
  seedDefaultQuizQuestions,
  type AdminQuizRpcClient,
} from './adminQuiz.service';

function clientWith(data: unknown): AdminQuizRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('owner quiz service', () => {
  it('loads owner quiz controls without result split before reveal', async () => {
    const client = clientWith({
      status: 'ok',
      phase: 'voting',
      currentQuestionId: 'question-2',
      answeredCount: 18,
      questions: [
        {
          id: 'question-1',
          text: 'Кто дольше собирается?',
          questionType: 'standard',
          sortOrder: 1,
          enabled: true,
          imagePath: null,
        },
        {
          id: 'question-2',
          text: 'Кто первым мирится после ссоры?',
          questionType: 'standard',
          sortOrder: 2,
          enabled: true,
          imagePath: null,
        },
      ],
    });

    const result = await getOwnerQuizControl(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_quiz_control', {
      p_event_id: 'event-1',
    });
    expect(result.phase).toBe('voting');
    expect(result.currentQuestionId).toBe('question-2');
    expect(result.answeredCount).toBe(18);
    expect(result.questions).toHaveLength(2);
    expect('results' in result).toBe(false);
  });

  it('parses aggregate result split only in results phase', async () => {
    const client = clientWith({
      status: 'ok',
      phase: 'results',
      currentQuestionId: 'question-2',
      answeredCount: 30,
      questions: [],
      results: { liza: 18, viktor: 12, total: 30 },
    });

    const result = await getOwnerQuizControl(client, 'event-1');

    expect(result.phase).toBe('results');
    if (result.phase === 'results') {
      expect(result.results).toEqual({ liza: 18, viktor: 12, total: 30 });
    }
  });

  it('seeds default questions through the owner RPC', async () => {
    const client = clientWith({ status: 'seeded', insertedCount: 30 });

    const result = await seedDefaultQuizQuestions(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_seed_default_quiz_questions', {
      p_event_id: 'event-1',
    });
    expect(result).toEqual({ status: 'seeded', insertedCount: 30 });
  });

  it('activates and reveals only through owner RPCs', async () => {
    const activateClient = clientWith({
      status: 'active',
      questionId: 'question-3',
      phase: 'voting',
    });
    const revealClient = clientWith({
      status: 'revealed',
      questionId: 'question-3',
      results: { liza: 21, viktor: 9, total: 30 },
    });

    await activateOwnerQuizQuestion(activateClient, 'event-1', 'question-3');
    const reveal = await revealOwnerQuizResults(revealClient, 'event-1', 'question-3');

    expect(activateClient.rpc).toHaveBeenCalledWith('owner_activate_quiz_question', {
      p_event_id: 'event-1',
      p_question_id: 'question-3',
    });
    expect(revealClient.rpc).toHaveBeenCalledWith('owner_reveal_quiz_results', {
      p_event_id: 'event-1',
      p_question_id: 'question-3',
    });
    expect(reveal.results.total).toBe(30);
  });
});
