import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  broadcastBunkerRefresh,
  type BunkerRealtimeClient,
} from '../bunker/bunker.realtime';
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
  closeMkRegistration,
  finalizeMkDraw,
  getOwnerMkControl,
  openMkRegistration,
  promoteMkWaitlist,
  randomizeMkSeeds,
  recordMkWinner,
  removeMkPlayer,
  resetMkTournament,
  setCurrentMkMatch,
  setMkMainScreen,
  swapMkSeeds,
  undoMkResult,
  type MkOwnerRpcClient,
} from '../mortalKombat/mk.owner.service';
import { broadcastMkRefresh, subscribeToMkRefresh, type MkRealtimeClient } from '../mortalKombat/mk.realtime';
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
  applyCarriageDistribution as applyCarriageDistributionRpc,
  deleteGuest as deleteGuestRpc,
  issueGuestRecovery as issueGuestRecoveryRpc,
  loadOwnerDashboard,
  lockComposition as lockCompositionRpc,
  reassignGuest as reassignGuestRpc,
  resetEventTestData as resetEventTestDataRpc,
  type AdminDashboard,
  type CarriageDistributionResult,
  type EventTestResetResult,
} from './admin.service';
import {
  subscribeToGuestRegistrations,
  type AdminRealtimeClient,
} from './admin.realtime';
import { AdminShell } from './AdminShell';
import type { GuestReassignmentCommand } from './guests/AdminGuestsPage';
import type { AdminMkControlDependencies } from './mortalKombat/AdminMkControl';
import type { AdminPremiereControlDependencies } from './premiere/AdminPremiereControl';
import type { AdminCouplePreanswersPanelDependencies } from './quiz/AdminCouplePreanswersPanel';
import type { AdminFinalFivePanelDependencies } from './quiz/AdminFinalFivePanel';
import type { AdminQuizPanelDependencies } from './quiz/AdminQuizPanel';
import { isOwnerSessionExpired } from './ownerSession';
import {
  AdminBunkerDock,
  type AdminBunkerDockDependencies,
} from './bunker/AdminBunkerDock';

const EVENT_SLUG = 'liza-viktor';
const OWNER_EMAIL = 'qazasddaemon1602@gmail.com';

export type AdminSession = { userId: string };

export type AdminPageDependencies = {
  getSession: () => Promise<AdminSession | null>;
  subscribeToAuthState?: (callback: (session: AdminSession | null) => void) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadDashboard: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (command: GuestReassignmentCommand) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
  applyCarriageDistribution?: (
    eventId: string,
    carriageCount: number,
  ) => Promise<CarriageDistributionResult>;
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
  mortalKombat?: AdminMkControlDependencies;
  bunkerDock?: AdminBunkerDockDependencies;
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

export function createReassignGuestDependency(
  reassign: (guestId: string, carriageId: string) => Promise<void>,
  broadcast: (carriageIds: string[]) => Promise<void>,
) {
  return async (command: GuestReassignmentCommand): Promise<void> => {
    await reassign(command.guestId, command.toCarriageId);
    try {
      await broadcast([...new Set([command.fromCarriageId, command.toCarriageId])]);
    } catch {
      // Realtime is best effort; the successful RPC remains authoritative.
    }
  };
}

export function createAdminPageDependencies(): AdminPageDependencies {
  const client = getSupabaseClient();
  const bunkerRealtimeClient = client as unknown as BunkerRealtimeClient;
  const carriageRpcClient = client as unknown as CarriageCallRpcClient;
  const carriageRealtimeClient = client as unknown as CarriageCallRealtimeClient;
  const mkRpcClient = client as unknown as MkOwnerRpcClient;
  const mkRealtimeClient = client as unknown as MkRealtimeClient;
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
    subscribeToAuthState: (callback) => {
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        callback(nextSession ? { userId: nextSession.user.id } : null);
      });
      return () => data.subscription.unsubscribe();
    },
    signIn: async (email, password) => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    loadDashboard,
    deleteGuest: (guestId) => deleteGuestRpc(client, guestId),
    reassignGuest: createReassignGuestDependency(
      (guestId, carriageId) => reassignGuestRpc(client, guestId, carriageId),
      (carriageIds) => broadcastCarriageCallRefresh(carriageRealtimeClient, carriageIds),
    ),
    lockComposition: (eventId) => lockCompositionRpc(client, eventId),
    applyCarriageDistribution: (eventId, carriageCount) =>
      applyCarriageDistributionRpc(client, eventId, carriageCount),
    issueGuestRecovery: (guestId) => issueGuestRecoveryRpc(client, guestId),
    resetEventTestData: async (eventId, confirmation) => {
      const result = await resetEventTestDataRpc(client, eventId, confirmation);
      await Promise.allSettled([
        broadcastPremiereRefresh(premiereRealtimeClient, EVENT_SLUG),
        broadcastQuizRefresh(quizRealtimeClient, EVENT_SLUG),
        broadcastMkRefresh(mkRealtimeClient, EVENT_SLUG),
        broadcastBunkerRefresh(bunkerRealtimeClient, EVENT_SLUG),
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
    mortalKombat: {
      load: (eventId) => getOwnerMkControl(mkRpcClient, eventId),
      open: (eventId) => openMkRegistration(mkRpcClient, eventId),
      close: (eventId) => closeMkRegistration(mkRpcClient, eventId),
      randomize: (eventId) => randomizeMkSeeds(mkRpcClient, eventId),
      swap: (registrationA, registrationB) => swapMkSeeds(mkRpcClient, registrationA, registrationB),
      remove: (registrationId) => removeMkPlayer(mkRpcClient, registrationId),
      promote: (registrationId) => promoteMkWaitlist(mkRpcClient, registrationId),
      reset: (eventId, confirmation) => resetMkTournament(mkRpcClient, eventId, confirmation),
      finalize: (eventId) => finalizeMkDraw(mkRpcClient, eventId),
      setCurrent: (matchId) => setCurrentMkMatch(mkRpcClient, matchId),
      setMainScreen: (eventId, enabled) => setMkMainScreen(mkRpcClient, eventId, enabled),
      recordWinner: (matchId, winnerGuestId, clearDownstream) => recordMkWinner(
        mkRpcClient,
        matchId,
        winnerGuestId,
        clearDownstream,
      ),
      undo: (matchId, clearDownstream) => undoMkResult(mkRpcClient, matchId, clearDownstream),
      broadcastRefresh: () => broadcastMkRefresh(mkRealtimeClient, EVENT_SLUG),
      subscribeToRefresh: (callback) => subscribeToMkRefresh(mkRealtimeClient, EVENT_SLUG, callback),
    },
    bunkerDock: {
      loadDashboard,
      applyDistribution: (eventId, carriageCount) => applyCarriageDistributionRpc(
        client,
        eventId,
        carriageCount,
      ),
    },
  };
}

type AdminPageProps = {
  dependencies?: AdminPageDependencies;
};

export function AdminPage({ dependencies }: AdminPageProps) {
  const deps = useMemo(() => dependencies ?? createAdminPageDependencies(), [dependencies]);
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hadOwnerSession = useRef(false);
  const signingOut = useRef(false);

  const expireOwnerSession = useCallback(() => {
    hadOwnerSession.current = false;
    setSession(null);
    setPassword('');
    setError('Owner-сессия истекла. Войдите снова.');
  }, []);

  useEffect(() => {
    let active = true;
    void deps.getSession()
      .then((nextSession) => {
        if (active) {
          hadOwnerSession.current = Boolean(nextSession);
          setSession(nextSession);
        }
      })
      .catch((sessionError) => {
        if (active) {
          setError(isOwnerSessionExpired(sessionError)
            ? 'Owner-сессия истекла. Войдите снова.'
            : 'Не удалось проверить owner-сессию.');
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [deps]);

  useEffect(() => {
    if (!deps.subscribeToAuthState) return undefined;
    return deps.subscribeToAuthState((nextSession) => {
      if (nextSession) {
        hadOwnerSession.current = true;
        setSession(nextSession);
        setError('');
        return;
      }
      if (signingOut.current) {
        hadOwnerSession.current = false;
        setSession(null);
        setError('');
        return;
      }
      if (hadOwnerSession.current) expireOwnerSession();
    });
  }, [deps, expireOwnerSession]);

  const handleSignOut = async () => {
    signingOut.current = true;
    try {
      await deps.signOut();
      hadOwnerSession.current = false;
      setSession(null);
      setPassword('');
      setError('');
    } catch {
      setError('Не удалось завершить owner-сессию. Проверьте связь.');
    } finally {
      signingOut.current = false;
    }
  };

  if (checking) {
    return (
      <main className="page-shell">
        <section className="placeholder-card" aria-live="polite">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ПРОВЕРЯЕМ ДОСТУП…</h1>
        </section>
      </main>
    );
  }

  if (session) {
    return (
      <>
        <div className="admin-owner-toolbar">
          <button
            type="button"
            className="admin-signout"
            onClick={() => void handleSignOut()}
          >
            ВЫЙТИ ИЗ АДМИНКИ
          </button>
          {error && <p className="admin-owner-toolbar__status" role="alert">{error}</p>}
        </div>
        <AdminShell
          dependencies={{
            load: deps.loadDashboard,
            deleteGuest: deps.deleteGuest,
            reassignGuest: deps.reassignGuest,
            lockComposition: deps.lockComposition,
            applyCarriageDistribution: deps.applyCarriageDistribution,
            issueGuestRecovery: deps.issueGuestRecovery,
            resetEventTestData: deps.resetEventTestData,
            subscribeToRegistrations: deps.subscribeToRegistrations,
            sendCarriageCall: deps.sendCarriageCall,
            clearCarriageCall: deps.clearCarriageCall,
            couplePreanswers: deps.couplePreanswers,
            premiere: deps.premiere,
            quiz: deps.quiz,
            finalFive: deps.finalFive,
            mortalKombat: deps.mortalKombat,
            onSessionExpired: expireOwnerSession,
          }}
        />
        {deps.bunkerDock && <AdminBunkerDock dependencies={deps.bunkerDock} />}
      </>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Введите email и пароль владельца.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await deps.signIn(email.trim(), password);
      const nextSession = await deps.getSession();
      setSession(nextSession);
      hadOwnerSession.current = Boolean(nextSession);
      if (!nextSession) setError('Owner-сессия не создана.');
    } catch (signInError) {
      const code = errorCode(signInError);
      setError(code === 'invalid_credentials'
        ? 'Неверный email или пароль.'
        : 'Не удалось войти в owner-панель.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="placeholder-card admin-login-card">
        <p className="eyebrow">OWNER ONLY</p>
        <h1>ВХОД В АДМИНКУ</h1>
        <p>Гостевые устройства не получают доступ к списку гостей и управляющим командам.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>Email владельца</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="registration-error" role="alert">{error}</p>}
          <button type="submit" className="registration-submit" disabled={submitting}>
            {submitting ? 'ПРОВЕРЯЕМ…' : 'ВОЙТИ В АДМИНКУ'}
          </button>
        </form>
      </section>
    </main>
  );
}
