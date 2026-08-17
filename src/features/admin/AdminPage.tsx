import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  deleteGuest as deleteGuestRpc,
  issueGuestRecovery as issueGuestRecoveryRpc,
  loadOwnerDashboard,
  lockComposition as lockCompositionRpc,
  reassignGuest as reassignGuestRpc,
  type AdminDashboard,
} from './admin.service';
import {
  subscribeToGuestRegistrations,
  type AdminRealtimeClient,
} from './admin.realtime';
import { AdminShell } from './AdminShell';

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
  subscribeToRegistrations: (callback: (guestId: string) => void) => () => void;
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return String((error as { code?: unknown }).code ?? '');
}

export function createAdminPageDependencies(): AdminPageDependencies {
  const client = getSupabaseClient();
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
    subscribeToRegistrations: (callback) => {
      if (!currentEventId) return () => undefined;
      return subscribeToGuestRegistrations(
        client as unknown as AdminRealtimeClient,
        currentEventId,
        callback,
      );
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
        subscribeToRegistrations: deps.subscribeToRegistrations,
      }}
    />
  );
}
