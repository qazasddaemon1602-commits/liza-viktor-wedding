import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { subscribeToQuizRefresh, type QuizRealtimeClient } from '../quiz/quiz.realtime';
import {
  getGuestQuizState,
  submitGuestQuizVote,
  type GuestQuizState,
  type QuizChoice,
  type QuizRpcClient,
  type SubmitQuizVoteResult,
} from '../quiz/quiz.service';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type GuestQuizLiveDependencies = {
  getDeviceKey: () => string;
  load: (deviceKey: string) => Promise<GuestQuizState>;
  vote: (deviceKey: string, questionId: string, choice: QuizChoice) => Promise<SubmitQuizVoteResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type UseGuestQuizLiveStateOptions = {
  eventSlug?: string;
  dependencies?: GuestQuizLiveDependencies;
  enabled?: boolean;
};

function browserDependencies(eventSlug: string): GuestQuizLiveDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as QuizRpcClient;
  const realtimeClient = client as unknown as QuizRealtimeClient;
  let cachedDeviceKey: string | undefined;
  const getDeviceKey = () => {
    cachedDeviceKey ??= getOrCreateDeviceKey();
    return cachedDeviceKey;
  };
  return {
    getDeviceKey,
    load: (deviceKey) => getGuestQuizState(rpcClient, eventSlug, deviceKey),
    vote: (deviceKey, questionId, choice) => submitGuestQuizVote(
      rpcClient,
      eventSlug,
      deviceKey,
      questionId,
      choice,
    ),
    subscribeToRefresh: (callback) => subscribeToQuizRefresh(realtimeClient, eventSlug, callback),
  };
}

export function useGuestQuizLiveState({
  eventSlug = DEFAULT_EVENT_SLUG,
  dependencies,
  enabled = true,
}: UseGuestQuizLiveStateOptions = {}) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<GuestQuizState | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<QuizChoice | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return null;
    try {
      const next = await deps.load(deps.getDeviceKey());
      setState(next);
      setError('');
      return next;
    } catch {
      setError('Не удалось обновить Live Quiz. Билет остаётся доступен.');
      return null;
    }
  }, [deps, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const unsubscribe = deps.subscribeToRefresh?.(() => { void reload(); });
    return () => unsubscribe?.();
  }, [deps, enabled, reload]);

  useEffect(() => {
    if (!enabled || state?.status !== 'active' || !state.phaseEndsAt) return;
    const deadline = Date.parse(state.phaseEndsAt);
    if (!Number.isFinite(deadline)) return;
    const delay = Math.max(0, deadline - Date.now()) + 120;
    const timer = window.setTimeout(() => { void reload(); }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, reload, state]);

  useEffect(() => {
    if (!enabled) return;
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
    };
  }, [enabled, reload]);

  const vote = useCallback(async (choice: QuizChoice) => {
    if (state?.status !== 'active' || state.phase !== 'voting' || state.selectedChoice || submitting) return;
    if (state.phaseEndsAt && Date.parse(state.phaseEndsAt) <= Date.now()) {
      void reload();
      return;
    }
    setSubmitting(choice);
    setError('');
    try {
      const result = await deps.vote(deps.getDeviceKey(), state.question.id, choice);
      setState((current) => {
        if (current?.status !== 'active' || current.phase !== 'voting') return current;
        return {
          ...current,
          selectedChoice: result.choice,
          answeredCount: result.status === 'accepted'
            ? current.answeredCount + 1
            : current.answeredCount,
        };
      });
    } catch {
      setError('Ответ не отправился. Если время ещё осталось — попробуйте снова.');
      void reload();
    } finally {
      setSubmitting(null);
    }
  }, [deps, reload, state, submitting]);

  return { state, error, submitting, reload, vote };
}
