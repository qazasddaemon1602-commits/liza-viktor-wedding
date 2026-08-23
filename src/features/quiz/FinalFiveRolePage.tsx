import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  broadcastBunkerRefresh,
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from '../bunker/bunker.realtime';
import {
  LizaBunkerOperatorPanel,
  type LizaBunkerOperatorPanelDependencies,
} from '../bunker/operator/LizaBunkerOperatorPanel';
import {
  getLizaBunkerOperatorState,
  submitLizaBunkerOperatorPhrase,
  type BunkerOperatorRpcClient,
  type LizaBunkerOperatorState,
} from '../bunker/operator/bunkerOperator.service';
import {
  getBunkerV2Results,
} from '../bunker/v2/results.service';
import type { BunkerV2RpcClient } from '../bunker/v2/command.service';
import {
  getFinalFiveRoleState,
  submitFinalFiveAnswer,
  type FinalFiveChoice,
  type FinalFiveRole,
  type FinalFiveRoleState,
  type FinalFiveRpcClient,
  type SubmitFinalFiveAnswerResult,
} from './finalFive.service';
import {
  subscribeToQuizRefresh,
  type QuizRealtimeClient,
} from './quiz.realtime';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type FinalFiveRolePageDependencies = {
  load: (token: string) => Promise<FinalFiveRoleState>;
  submit: (token: string, questionId: string, choice: FinalFiveChoice) => Promise<SubmitFinalFiveAnswerResult>;
  subscribeToRefresh: (callback: () => void) => () => void;
};

type FinalFiveRolePageProps = {
  role: FinalFiveRole;
  token?: string;
  eventSlug?: string;
  dependencies?: FinalFiveRolePageDependencies;
  operatorDependencies?: LizaBunkerOperatorPanelDependencies;
};

function tokenFromLocation(): string {
  return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
}

function browserDependencies(eventSlug: string, role: FinalFiveRole): FinalFiveRolePageDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as FinalFiveRpcClient;
  const realtimeClient = client as unknown as QuizRealtimeClient;
  return {
    load: (token) => getFinalFiveRoleState(rpcClient, eventSlug, role, token),
    submit: (token, questionId, choice) => submitFinalFiveAnswer(
      rpcClient,
      eventSlug,
      role,
      token,
      questionId,
      choice,
    ),
    subscribeToRefresh: (callback) => subscribeToQuizRefresh(realtimeClient, eventSlug, callback),
  };
}

function browserOperatorDependencies(eventSlug: string): LizaBunkerOperatorPanelDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as BunkerOperatorRpcClient;
  const resultsClient = client as unknown as BunkerV2RpcClient;
  const realtimeClient = client as unknown as BunkerRealtimeClient;
  return {
    load: (token) => getLizaBunkerOperatorState(rpcClient, eventSlug, token),
    submit: (token, stage, optionKey) => submitLizaBunkerOperatorPhrase(
      rpcClient,
      eventSlug,
      token,
      stage,
      optionKey,
    ),
    loadResults: () => getBunkerV2Results(resultsClient, eventSlug),
    subscribe: (callback) => subscribeToBunkerRefresh(realtimeClient, eventSlug, callback),
    broadcast: () => broadcastBunkerRefresh(realtimeClient, eventSlug),
  };
}

function roleLabel(role: FinalFiveRole): string {
  return role === 'liza' ? 'ЛИЗА' : 'ВИКТОР';
}

export function FinalFiveRolePage({
  role,
  token,
  eventSlug = DEFAULT_EVENT_SLUG,
  dependencies,
  operatorDependencies,
}: FinalFiveRolePageProps) {
  const accessToken = useMemo(() => token ?? tokenFromLocation(), [token]);
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug, role),
    [dependencies, eventSlug, role],
  );
  const operatorDeps = useMemo(
    () => operatorDependencies ?? (dependencies ? null : browserOperatorDependencies(eventSlug)),
    [dependencies, eventSlug, operatorDependencies],
  );
  const [operatorState, setOperatorState] = useState<LizaBunkerOperatorState | null>(null);
  const [operatorChecked, setOperatorChecked] = useState(role !== 'liza' || !operatorDeps);
  const [state, setState] = useState<FinalFiveRoleState | null>(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const operatorMode = operatorState !== null
    && operatorState.status !== 'invalid_access'
    && (operatorState.status !== 'idle' || operatorState.bunkerActive);

  useEffect(() => {
    setOperatorState(null);
    setOperatorChecked(role !== 'liza' || !operatorDeps);
  }, [accessToken, operatorDeps, role]);

  useEffect(() => {
    if (role !== 'liza' || !operatorDeps || !accessToken || operatorMode) return;
    let active = true;
    let inFlight = false;
    let queued = false;

    const reloadOperator = () => {
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      void operatorDeps.load(accessToken)
        .then((next) => {
          if (active) setOperatorState(next);
        })
        .catch(() => {
          // Final Five remains usable while the Bunker read-model reconnects.
        })
        .finally(() => {
          inFlight = false;
          if (active) setOperatorChecked(true);
          if (active && queued) {
            queued = false;
            reloadOperator();
          }
        });
    };

    reloadOperator();
    const unsubscribe = operatorDeps.subscribe(reloadOperator);
    const poll = window.setInterval(reloadOperator, 2_000);
    return () => {
      active = false;
      queued = false;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [accessToken, operatorDeps, operatorMode, role]);

  useEffect(() => {
    if (!accessToken || (role === 'liza' && operatorDeps && (!operatorChecked || operatorMode))) return;
    let active = true;

    const reload = () => {
      setError('');
      void deps.load(accessToken)
        .then((next) => {
          if (active) setState(next);
        })
        .catch(() => {
          if (active) setError('Не удалось загрузить личный ответ.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    reload();
    const unsubscribe = deps.subscribeToRefresh(reload);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [accessToken, deps, operatorChecked, operatorDeps, operatorMode, role]);

  const choose = async (choice: FinalFiveChoice) => {
    if (!accessToken || !state || state.status !== 'active' || state.phase !== 'voting' || saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await deps.submit(accessToken, state.question.id, choice);
      setState((current) => current?.status === 'active'
        ? { ...current, selectedChoice: saved.choice }
        : current);
    } catch {
      setError('Ответ не сохранился. Проверьте интернет и нажмите ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  if (!accessToken) {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card" role="alert">
          <p className="eyebrow">ФИНАЛЬНАЯ ПЯТЁРКА</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>Откройте персональную ссылку, которую прислал организатор.</p>
        </section>
      </main>
    );
  }

  if (role === 'liza' && operatorDeps && !operatorChecked) {
    return (
      <main className="bunker-player-shell bunker-operator-shell">
        <section className="bunker-operator-panel" aria-live="polite">
          <p>BK-17 · PRIVATE CHANNEL</p>
          <h1>ПОДКЛЮЧАЕМ КАНАЛ…</h1>
        </section>
      </main>
    );
  }

  if (role === 'liza' && operatorDeps && operatorState?.status === 'invalid_access') {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card" role="alert">
          <p className="eyebrow">ЛИЗА · PRIVATE</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>Попросите организатора перевыдать персональную ссылку.</p>
        </section>
      </main>
    );
  }

  if (role === 'liza' && operatorDeps && operatorState && operatorMode) {
    return (
      <LizaBunkerOperatorPanel
        token={accessToken}
        initialState={operatorState}
        dependencies={operatorDeps}
        onLeaveOperatorMode={setOperatorState}
      />
    );
  }

  if (loading) {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card" aria-live="polite">
          <p className="eyebrow">{roleLabel(role)} · PRIVATE</p>
          <h1>ПОДКЛЮЧАЕМСЯ…</h1>
        </section>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card" role="alert">
          <p className="eyebrow">{roleLabel(role)} · PRIVATE</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!state || state.status === 'invalid_access' || state.status === 'not_found') {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card" role="alert">
          <p className="eyebrow">{roleLabel(role)} · PRIVATE</p>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>Попросите организатора перевыдать персональную ссылку.</p>
        </section>
      </main>
    );
  }

  if (state.status === 'idle') {
    return (
      <main className="final-five-role-shell">
        <section className="final-five-role-card">
          <p className="eyebrow">{roleLabel(role)} · PRIVATE</p>
          <h1>ЖДЁМ ФИНАЛЬНЫЙ РАУНД</h1>
          <p>Оставьте страницу открытой. Новый вопрос появится автоматически.</p>
        </section>
      </main>
    );
  }

  if (state.status !== 'active') {
    return null;
  }

  const locked = state.phase === 'results';

  return (
    <main className="final-five-role-shell">
      <section className="final-five-role-card">
        <p className="eyebrow">ФИНАЛЬНАЯ ПЯТЁРКА · ТОЛЬКО ДЛЯ ВАС</p>
        <h1>{roleLabel(role)} · ЛИЧНЫЙ ОТВЕТ</h1>
        <p className="final-five-role-question">{state.question.text}</p>

        <div className="final-five-role-choices" aria-label="Ваш личный ответ">
          <button
            type="button"
            aria-pressed={state.selectedChoice === 'liza'}
            disabled={locked || saving}
            onClick={() => void choose('liza')}
          >
            ЛИЗА
          </button>
          <button
            type="button"
            aria-pressed={state.selectedChoice === 'viktor'}
            disabled={locked || saving}
            onClick={() => void choose('viktor')}
          >
            ВИКТОР
          </button>
        </div>

        {saving && <p aria-live="polite">СОХРАНЯЕМ…</p>}
        {locked && (
          <div className="final-five-role-locked">
            <strong>ОТВЕТ ПРИНЯТ</strong>
            <span>ЖДЁМ ПОКАЗА</span>
          </div>
        )}
        {!locked && state.selectedChoice && <p>Можно изменить выбор, пока голосование открыто.</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
