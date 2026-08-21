import { useMemo } from 'react';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from '../bunker/bunker.realtime';
import type { BunkerRpcClient } from '../bunker/bunker.service';
import {
  getGuestBunkerQuest,
  submitBunkerFinalCode,
  submitBunkerMission,
} from '../bunker/bunkerQuest.service';
import { getGuestBunkerRuntime } from '../bunker/bunkerRuntime.service';
import {
  confirmMissionOneSelection,
  getGuestMissionOneReadModel,
} from '../bunker/v2/m01.service';
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
  quizClient?: QuizRpcClient;
  quizRealtimeClient?: QuizRealtimeClient;
  bunkerClient?: BunkerRpcClient;
  bunkerRealtimeClient?: BunkerRealtimeClient;
  eventSlug?: string;
  deviceKey?: string;
  revealDelayMs?: number;
};

export function GuestJoinPage({
  client,
  realtimeClient,
  quizClient,
  quizRealtimeClient,
  bunkerClient,
  bunkerRealtimeClient,
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
    const activeQuizClient = quizClient
      ?? (browserSupabase as unknown as QuizRpcClient | null)
      ?? undefined;
    const activeBunkerClient = bunkerClient
      ?? (browserSupabase as unknown as BunkerRpcClient | null)
      ?? undefined;
    const activeCarriageRealtimeClient = realtimeClient
      ?? (browserSupabase as unknown as CarriageCallRealtimeClient | null)
      ?? undefined;
    const activeQuizRealtimeClient = quizRealtimeClient
      ?? (browserSupabase as unknown as QuizRealtimeClient | null)
      ?? undefined;
    const activeBunkerRealtimeClient = bunkerRealtimeClient
      ?? (browserSupabase as unknown as BunkerRealtimeClient | null)
      ?? undefined;
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
      quiz: activeQuizClient ? {
        getDeviceKey,
        load: (key) => getGuestQuizState(activeQuizClient, eventSlug, key),
        vote: (key, questionId, choice) => submitGuestQuizVote(
          activeQuizClient,
          eventSlug,
          key,
          questionId,
          choice,
        ),
        subscribeToRefresh: activeQuizRealtimeClient
          ? (callback) => subscribeToQuizRefresh(activeQuizRealtimeClient, eventSlug, callback)
          : undefined,
      } : undefined,
      bunker: activeBunkerClient ? {
        getDeviceKey,
        load: (key) => getGuestBunkerQuest(activeBunkerClient, eventSlug, key),
        loadRuntime: (key) => getGuestBunkerRuntime(activeBunkerClient, eventSlug, key),
        loadMissionOne: (key) => getGuestMissionOneReadModel(activeBunkerClient, eventSlug, key),
        confirmMissionOne: (key, input) => confirmMissionOneSelection(activeBunkerClient, {
          eventSlug,
          deviceKey: key,
          ...input,
        }),
        submitMission: (key, stage, answer) => submitBunkerMission(
          activeBunkerClient,
          eventSlug,
          key,
          stage,
          answer,
        ),
        submitFinalCode: (key, code) => submitBunkerFinalCode(
          activeBunkerClient,
          eventSlug,
          key,
          code,
        ),
        subscribeToRefresh: activeBunkerRealtimeClient
          ? (callback) => subscribeToBunkerRefresh(activeBunkerRealtimeClient, eventSlug, callback)
          : undefined,
      } : undefined,
    };
  }, [
    bunkerClient,
    bunkerRealtimeClient,
    client,
    deviceKey,
    eventSlug,
    quizClient,
    quizRealtimeClient,
    realtimeClient,
  ]);

  return <JoinPage dependencies={dependencies} revealDelayMs={revealDelayMs} />;
}
