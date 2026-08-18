import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  broadcastCarriageCallRefresh,
  type CarriageCallRealtimeClient,
} from '../carriages/carriageCalls.realtime';
import {
  clearCarriageCall as clearCarriageCallRpc,
  publishCarriageCallToScreen,
  sendCarriageCall as sendCarriageCallRpc,
  type CarriageCallRpcClient,
  type OwnerCarriageCall,
} from '../carriages/carriageCalls.service';
import {
  broadcastPremiereRefresh,
  type PremiereRealtimeClient,
} from '../premiere/premiere.realtime';
import {
  subscribeToPremiereScreenPresence,
  type PremierePresenceRealtimeClient,
} from '../premiere/premierePresence.realtime';
import {
  cancelPremiere,
  getOwnerPremiereControl,
  pausePremiere,
  restartPremiere,
  resumePremiere,
  returnMainScreen,
  seekPremiere,
  setPremiereBlack,
  setPremiereCountdownSound,
  setPremiereMedia,
  setPremiereStandby,
  startPremiere,
  type PremiereRpcClient,
} from '../premiere/premiere.service';
import {
  activateOwnerQuizQuestion,
  getOwnerQuizControl,
  revealOwnerQuizResults,
  seedDefaultQuizQuestions,
  type AdminQuizRpcClient,
} from '../quiz/adminQuiz.service';
import {
  getOwnerCoupleRevealStatus,
  revealOwnerCoupleAnswer,
  type CoupleRevealRpcClient,
} from '../quiz/coupleReveal.service';
import {
  getOwnerCouplePreanswerStatus,
  issueOwnerCouplePreanswerAccess,
  type OwnerCouplePreanswerRpcClient,
} from '../quiz/ownerCouplePreanswers.service';
import {
  getOwnerFinalFiveStatus,
  issueFinalFiveRoleAccess,
  revealFinalFive,
  seedFinalFiveQuestions,
  type FinalFiveRole,
  type FinalFiveRpcClient,
} from '../quiz/finalFive.service';
import {
  broadcastQuizRefresh,
  type QuizRealtimeClient,
} from '../quiz/quiz.realtime';
import { getSupabaseClient } from '../../lib/supabase';
import {
  deleteGuest as deleteGuestRpc,
  issueGuestRecovery as issueGuestRecoveryRpc,
  loadOwnerDashboard,
  lockComposition as lockCompositionRpc,
  reassignGuest as reassignGuestRpc,
  resetEventTestData as resetEventTestDataRpc,
  type AdminDashboard,
  type EventTestResetResult,
} from './admin.service';
import {
  subscribeToGuestRegistrations,
  type AdminRealtimeClient,
} from './admin.realtime';
import { AdminShell } from './AdminShell';
import type { AdminPremiereControlDependencies } from './premiere/AdminPremiereControl';
import type { AdminCouplePreanswersPanelDependencies } from './quiz/AdminCouplePreanswersPanel';
import type { AdminFinalFivePanelDependencies } from './quiz/AdminFinalFivePanel';
import type { AdminQuizPanelDependencies } from './quiz/AdminQuizPanel';

const EVENT_SLUG = 'liza-viktor';

export type AdminSession = { userId: string };

export type AdminPageDependencies = {
  getSession: () => Promise<AdminSession | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadDashboard: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (guestId: string, carriageId: string) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
  issueGuestRecovery: (guestId: string) => Promise<{ code: string; expiresAt: string }>;
  resetEventTestData?: (eventId: string, confirmation: string) => Promise<EventTestResetResult>;
  subscribeToRegistrations: (callback: (guestId: string) => void) => () => void;
  sendCarriageCall?: (
    carriageIds: string[],
    message: string,
    showOnScreen: boolean,
  ) => Promise<OwnerCarriageCall>;
  clearCarriageCall?: (callId: string, carriageIds: string[]) => Promise<void>;
  couplePreanswers?: AdminCouplePreanswersPanelDependencies;
  premiere?: AdminPremiereControlDependencies;
  quiz?: AdminQuizPanelDependencies;
  finalFive?: AdminFinalFivePanelDependencies;
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return String((error as { code?: unknown }).code ?? '');
}

function buildCoupleAccessUrl(token: string): string {
  const url = new URL('/couple-preanswers', window.location.origin);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildFinalFiveRoleUrl(role: FinalFiveRole, token: string): string {
  const url = new URL(role === 'liza' ? '/liza' : '/viktor', window.location.origin);
  url.searchParams.set('token', token);
  return url.toString();
}

export function createAdminPageDependencies(): AdminPageDependencies {
  const client = getSupabaseClient();
  const carriageRpcClient = client as unknown as CarriageCallRpcClient;
  const carriageRealtimeClient = client as unknown as CarriageCallRealtimeClient;
  const premiereRpcClient = client as unknown as PremiereRpcClient;
  const premiereRealtimeClient = client as unknown as PremiereRealtimeClient;
  const premierePresenceRealtimeClient = client as unknown as PremierePresenceRealtimeClient;
  const quizRpcClient = client as unknown as AdminQuizRpcClient;
  const coupleRevealRpcClient = client as unknown as CoupleRevealRpcClient;
  const coupleRpcClient = client as unknown as OwnerCouplePreanswerRpcClient;
  const finalFiveRpcClient = client as unknown as FinalFiveRpcClient;
  const quizRealtimeClient = client as unknown as QuizRealtimeClient;
  let currentEventId = '';

  const loadDashboard = async () => {
    const dashboard = await loadOwnerDashboard(client, EVENT_SLUG);
    currentEventId = dashboard.event.id;
    return dashboard;
  };

  return {
    getSession: async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session ? { userId: data.session.user.id } : null;
    },
    signIn: async (email, password) => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    loadDashboard,
    deleteGuest: (guestId) => deleteGuestRpc(client, guestId),
    reassignGuest: (guestId, carriageId) => reassignGuestRpc(client, guestId, carriageId),
    lockComposition: (eventId) => lockCompositionRpc(client, eventId),
    issueGuestRecovery: (guestId) => issueGuestRecoveryRpc(client, guestId),
    resetEventTestData: async (eventId, confirmation) => {
      const result = await resetEventTestDataRpc(client, eventId, confirmation);
      await Promise.all([
        broadcastPremiereRefresh(premiereRealtimeClient, EVENT_SLUG),
        broadcastQuizRefresh(quizRealtimeClient, EVENT_SLUG),
      ]);
      return result;
    },
    subscribeToRegistrations: (callback) => {
      if (!currentEventId) return () => undefined;
      return subscribeToGuestRegistrations(
        client as unknown as AdminRealtimeClient,
        currentEventId,
        callback,
      );
    },
    sendCarriageCall: async (carriageIds, message, showOnScreen) => {
      if (!currentEventId) throw new Error('Event dashboard must load before sending carriage calls');
      const call = await sendCarriageCallRpc(
        carriageRpcClient,
        currentEventId,
        carriageIds,
        message,
        showOnScreen,
      );
      await broadcastCarriageCallRefresh(carriageRealtimeClient, carriageIds);
      if (showOnScreen) {
        await publishCarriageCallToScreen(carriageRpcClient, call.callId);
      }
      return call;
    },
    clearCarriageCall: async (callId, carriageIds) => {
      await clearCarriageCallRpc(carriageRpcClient, callId);
      await broadcastCarriageCallRefresh(carriageRealtimeClient, carriageIds);
    },
    couplePreanswers: {
      load: (eventId) => getOwnerCouplePreanswerStatus(coupleRpcClient, eventId),
      issue: (eventId) => issueOwnerCouplePreanswerAccess(coupleRpcClient, eventId),
      buildAccessUrl: buildCoupleAccessUrl,
    },
    premiere: {
      load: (eventId) => getOwnerPremiereControl(premiereRpcClient, eventId),
      setMedia: (eventId, mediaUrl, durationSeconds) => setPremiereMedia(
        premiereRpcClient,
        eventId,
        mediaUrl,
        durationSeconds,
      ),
      standby: (eventId) => setPremiereStandby(premiereRpcClient, eventId),
      start: (eventId, countdownSeconds) => startPremiere(
        premiereRpcClient,
        eventId,
        countdownSeconds,
      ),
      cancel: (eventId) => cancelPremiere(premiereRpcClient, eventId),
      pause: (eventId) => pausePremiere(premiereRpcClient, eventId),
      resume: (eventId) => resumePremiere(premiereRpcClient, eventId),
      seek: (eventId, positionSeconds) => seekPremiere(
        premiereRpcClient,
        eventId,
        positionSeconds,
      ),
      restart: (eventId) => restartPremiere(premiereRpcClient, eventId),
      black: (eventId) => setPremiereBlack(premiereRpcClient, eventId),
      returnMain: (eventId) => returnMainScreen(premiereRpcClient, eventId),
      setCountdownSound: (eventId, enabled) => setPremiereCountdownSound(
        premiereRpcClient,
        eventId,
        enabled,
      ),
      broadcastRefresh: () => broadcastPremiereRefresh(premiereRealtimeClient, EVENT_SLUG),
      subscribeScreenPresence: (callback) => subscribeToPremiereScreenPresence(
        premierePresenceRealtimeClient,
        EVENT_SLUG,
        callback,
      ),
    },
    quiz: {
      load: (eventId) => getOwnerQuizControl(quizRpcClient, eventId),
      seed: (eventId) => seedDefaultQuizQuestions(quizRpcClient, eventId),
      activate: (eventId, questionId) => activateOwnerQuizQuestion(
        quizRpcClient,
        eventId,
        questionId,
      ),
      reveal: (eventId, questionId) => revealOwnerQuizResults(
        quizRpcClient,
        eventId,
        questionId,
      ),
      loadCoupleRevealStatus: (eventId, questionId) => getOwnerCoupleRevealStatus(
        coupleRevealRpcClient,
        eventId,
        questionId,
      ),
      revealCoupleAnswer: (eventId, questionId) => revealOwnerCoupleAnswer(
        coupleRevealRpcClient,
        eventId,
        questionId,
      ),
      broadcastRefresh: () => broadcastQuizRefresh(quizRealtimeClient, EVENT_SLUG),
    },
    finalFive: {
      loadQuiz: (eventId) => getOwnerQuizControl(quizRpcClient, eventId),
      seed: (eventId) => seedFinalFiveQuestions(finalFiveRpcClient, eventId),
      issueRole: (eventId, role) => issueFinalFiveRoleAccess(finalFiveRpcClient, eventId, role),
      buildRoleUrl: buildFinalFiveRoleUrl,
      activate: (eventId, questionId) => activateOwnerQuizQuestion(quizRpcClient, eventId, questionId),
      revealGuestResults: (eventId, questionId) => revealOwnerQuizResults(quizRpcClient, eventId, questionId),
      loadStatus: (eventId, questionId) => getOwnerFinalFiveStatus(finalFiveRpcClient, eventId, questionId),
      revealFinal: (eventId, questionId) => revealFinalFive(finalFiveRpcClient, eventId, questionId),
      broadcastRefresh: () => broadcastQuizRefresh(quizRealtimeClient, EVENT_SLUG),
    },
  };
}

type AdminPageProps = {
  dependencies?: AdminPageDependencies;
};

type AdminPageState =
  | { status: 'checking' }
  | { status: 'login'; message: string }
  | { status: 'denied' }
  | { status: 'ready'; dashboard: AdminDashboard };

export function AdminPage({ dependencies }: AdminPageProps) {
  const deps = useMemo(() => dependencies ?? createAdminPageDependencies(), [dependencies]);
  const [state, setState] = useState<AdminPageState>({ status: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bootstrapOwner = async () => {
    try {
      const dashboard = await deps.loadDashboard();
      setState({ status: 'ready', dashboard });
    } catch (error) {
      if (errorCode(error) === '42501') {
        setState({ status: 'denied' });
        return;
      }
      throw error;
    }
  };

  useEffect(() => {
    let cancelled = false;
    void deps.getSession()
      .then(async (session) => {
        if (cancelled) return;
        if (!session) {
          setState({ status: 'login', message: '' });
          return;
        }
        try {
          const dashboard = await deps.loadDashboard();
          if (!cancelled) setState({ status: 'ready', dashboard });
        } catch (error) {
          if (cancelled) return;
          if (errorCode(error) === '42501') {
            setState({ status: 'denied' });
          } else {
            setState({ status: 'login', message: 'Не удалось проверить доступ. Попробуйте ещё раз.' });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'login', message: 'Не удалось проверить сессию.' });
      });

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await deps.signIn(email.trim(), password);
      await bootstrapOwner();
    } catch (error) {
      if (errorCode(error) === '42501') {
        setState({ status: 'denied' });
      } else {
        setState({ status: 'login', message: 'Неверный логин/пароль или нет связи.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (state.status === 'checking') {
    return (
      <main className="page-shell">
        <section className="placeholder-card" aria-live="polite">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ПРОВЕРЯЕМ СЕССИЮ…</h1>
        </section>
      </main>
    );
  }

  if (state.status === 'denied') {
    return (
      <main className="page-shell">
        <section className="placeholder-card" role="alert">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ДОСТУП ЗАПРЕЩЁН</h1>
          <p>Эта панель открывается только аккаунту владельца события.</p>
          <button type="button" className="registration-secondary" onClick={() => void deps.signOut().then(() => setState({ status: 'login', message: '' }))}>
            ВЫЙТИ ИЗ АККАУНТА
          </button>
        </section>
      </main>
    );
  }

  if (state.status === 'login') {
    return (
      <main className="page-shell admin-login-shell">
        <section className="placeholder-card admin-login-card">
          <p className="eyebrow">ЛИЗА × ВИКТОР · OWNER ONLY</p>
          <h1>ВХОД В АДМИНКУ</h1>
          <p>Регистрация администраторов отключена. Войти может только заранее созданный аккаунт владельца.</p>
          <form onSubmit={submit} className="registration-form">
            <label>
              <span>Email владельца</span>
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Пароль</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {state.message && <p role="alert">{state.message}</p>}
            <button type="submit" className="registration-submit" disabled={submitting}>
              {submitting ? 'ВХОДИМ…' : 'ВОЙТИ В АДМИНКУ'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      dependencies={{
        load: deps.loadDashboard,
        deleteGuest: deps.deleteGuest,
        reassignGuest: deps.reassignGuest,
        lockComposition: deps.lockComposition,
        issueGuestRecovery: deps.issueGuestRecovery,
        resetEventTestData: deps.resetEventTestData,
        subscribeToRegistrations: deps.subscribeToRegistrations,
        sendCarriageCall: deps.sendCarriageCall,
        clearCarriageCall: deps.clearCarriageCall,
        couplePreanswers: deps.couplePreanswers,
        premiere: deps.premiere,
        quiz: deps.quiz,
        finalFive: deps.finalFive,
      }}
    />
  );
}
