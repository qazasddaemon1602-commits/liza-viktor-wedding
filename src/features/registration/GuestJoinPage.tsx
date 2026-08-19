import { useMemo } from 'react';
import {
  subscribeToCarriageCallRefresh,
  type CarriageCallRealtimeClient,
} from '../carriages/carriageCalls.realtime';
import {
  getGuestActiveCarriageCalls,
  type CarriageCallRpcClient,
} from '../carriages/carriageCalls.service';
import { subscribeToQuizRefresh, type QuizRealtimeClient } from '../quiz/quiz.realtime';
import {
  getGuestQuizState,
  submitGuestQuizVote,
  type QuizRpcClient,
} from '../quiz/quiz.service';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { JoinPage, type JoinPageDependencies } from './JoinPage';
import {
  recoverGuest,
  registerGuest,
  restoreGuest,
  type RegistrationRpcClient,
} from './registration.service';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

type GuestJoinPageProps = {
  client?: RegistrationRpcClient;
  realtimeClient?: CarriageCallRealtimeClient;
  eventSlug?: string;
  deviceKey?: string;
  revealDelayMs?: number;
};

export function GuestJoinPage({
  client,
  realtimeClient,
  eventSlug = DEFAULT_EVENT_SLUG,
  deviceKey,
  revealDelayMs,
}: GuestJoinPageProps) {
  const dependencies = useMemo<JoinPageDependencies>(() => {
    const browserSupabase = client ? null : getSupabaseClient();
    const registrationClient: RegistrationRpcClient = client ?? {
      rpc: async (name, args) => {
        const { data, error } = await browserSupabase!.rpc(name as never, args as never);
        return { data, error };
      },
    };
    const carriageCallClient = registrationClient as unknown as CarriageCallRpcClient;
    const quizClient = registrationClient as unknown as QuizRpcClient;
    const activeCarriageRealtimeClient = realtimeClient
      ?? (browserSupabase as unknown as CarriageCallRealtimeClient | null)
      ?? undefined;
    const activeQuizRealtimeClient = (browserSupabase as unknown as QuizRealtimeClient | null) ?? undefined;
    let cachedDeviceKey = deviceKey;
    const getDeviceKey = () => {
      cachedDeviceKey ??= getOrCreateDeviceKey();
      return cachedDeviceKey;
    };

    return {
      getDeviceKey,
      restore: (key) => restoreGuest(registrationClient, eventSlug, key),
      register: (draft, confirmDuplicate) => registerGuest(
        registrationClient,
        eventSlug,
        getDeviceKey(),
        draft,
        confirmDuplicate,
      ),
      recover: (key, recoveryCode) => recoverGuest(
        registrationClient,
        eventSlug,
        key,
        recoveryCode,
      ),
      loadCarriageCalls: (key) => getGuestActiveCarriageCalls(
        carriageCallClient,
        eventSlug,
        key,
      ),
      subscribeToCarriageCalls: activeCarriageRealtimeClient
        ? (carriageId, callback) => subscribeToCarriageCallRefresh(
          activeCarriageRealtimeClient,
          carriageId,
          callback,
        )
        : undefined,
      quiz: {
        getDeviceKey,
        load: (key) => getGuestQuizState(quizClient, eventSlug, key),
        vote: (key, questionId, choice) => submitGuestQuizVote(
          quizClient,
          eventSlug,
          key,
          questionId,
          choice,
        ),
        subscribeToRefresh: activeQuizRealtimeClient
          ? (callback) => subscribeToQuizRefresh(activeQuizRealtimeClient, eventSlug, callback)
          : undefined,
      },
    };
  }, [client, deviceKey, eventSlug, realtimeClient]);

  return <JoinPage dependencies={dependencies} revealDelayMs={revealDelayMs} />;
}
