import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BunkerOperatorStage } from './bunkerOperator.contract';
import type {
  LizaBunkerOperatorState,
  SubmitLizaBunkerOperatorResult,
} from './bunkerOperator.service';
import { BunkerResultsPlayer } from '../v2/BunkerResultsPlayer';
import type {
  BunkerV2ResultSummary,
  BunkerV2ResultsReadModel,
} from '../v2/results.service';

export type LizaBunkerOperatorPanelDependencies = {
  load: (token: string) => Promise<LizaBunkerOperatorState>;
  submit: (
    token: string,
    stage: BunkerOperatorStage,
    optionKey: string,
  ) => Promise<SubmitLizaBunkerOperatorResult>;
  loadResults: () => Promise<BunkerV2ResultsReadModel | null>;
  subscribe: (callback: () => void) => () => void;
  broadcast: () => Promise<void> | void;
};

type Props = {
  token: string;
  initialState: LizaBunkerOperatorState;
  dependencies: LizaBunkerOperatorPanelDependencies;
  onLeaveOperatorMode?: (
    state: Extract<LizaBunkerOperatorState, { status: 'invalid_access' | 'idle' }>,
  ) => void;
};

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function LizaBunkerOperatorPanel({
  token,
  initialState,
  dependencies,
  onLeaveOperatorMode,
}: Props) {
  const [state, setState] = useState(initialState);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BunkerV2ResultSummary | null>(null);
  const [resultsLoading, setResultsLoading] = useState(initialState.status === 'finished');
  const [resultsError, setResultsError] = useState('');
  const [portraitAvailable, setPortraitAvailable] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const syncedAt = useRef(Date.now());
  const stateRef = useRef(initialState);
  const sessionGeneration = useRef(0);
  const requestEpoch = useRef(0);
  const reloadRef = useRef<(() => void) | null>(null);
  const submitInFlight = useRef(false);
  const submitBarrier = useRef<{ stage: BunkerOperatorStage } | null>(null);
  const resultsInFlight = useRef(false);
  const reloadResultsRef = useRef<(() => void) | null>(null);
  const resultsRef = useRef<BunkerV2ResultSummary | null>(null);

  stateRef.current = state;
  resultsRef.current = results;

  const acceptState = useCallback((next: LizaBunkerOperatorState) => {
    syncedAt.current = Date.now();
    setClock(Date.now());
    stateRef.current = next;
    setState(next);
    setError('');
    if (
      next.status === 'invalid_access'
      || (next.status === 'idle' && !next.bunkerActive)
    ) onLeaveOperatorMode?.(next);
  }, [onLeaveOperatorMode]);

  useLayoutEffect(() => {
    sessionGeneration.current += 1;
    requestEpoch.current += 1;
    submitInFlight.current = false;
    submitBarrier.current = null;
    syncedAt.current = Date.now();
    stateRef.current = initialState;
    setState(initialState);
    setSelectedKey(null);
    setConfirming(false);
    setSubmitting(false);
    setError('');
    setResults(null);
    resultsRef.current = null;
    setResultsLoading(initialState.status === 'finished');
    setResultsError('');
    resultsInFlight.current = false;
    reloadResultsRef.current = null;
    setClock(Date.now());
  }, [dependencies, token]);

  const acceptLoadedState = useCallback((next: LizaBunkerOperatorState) => {
    const barrier = submitBarrier.current;
    if (barrier) {
      if (next.status === 'active' && next.stage === barrier.stage) {
        if (!next.selectedMessage) return;
        submitBarrier.current = null;
      } else {
        submitBarrier.current = null;
      }
    }
    acceptState(next);
  }, [acceptState]);

  const interactionIdentity = state.status === 'active'
    ? `${state.stage}:${state.selectedMessage?.id ?? 'open'}`
    : state.status;

  useEffect(() => {
    setSelectedKey(null);
    setConfirming(false);
  }, [interactionIdentity]);

  useEffect(() => {
    const generation = sessionGeneration.current;
    let active = true;
    let inFlight = false;
    let queued = false;
    const isCurrentSession = () => active && sessionGeneration.current === generation;

    const reload = () => {
      if (!isCurrentSession()) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      const epoch = requestEpoch.current;
      let request: Promise<LizaBunkerOperatorState>;
      try {
        request = dependencies.load(token);
      } catch (loadError) {
        request = Promise.reject(loadError);
      }
      void Promise.resolve(request)
        .then((next) => {
          if (isCurrentSession() && requestEpoch.current === epoch) acceptLoadedState(next);
        })
        .catch(() => {
          if (isCurrentSession() && requestEpoch.current === epoch) {
            setError('Связь нестабильна. Последний принятый сигнал сохранён.');
          }
        })
        .finally(() => {
          if (!isCurrentSession()) return;
          inFlight = false;
          if (queued) {
            queued = false;
            reload();
          }
        });
    };

    reloadRef.current = reload;
    const unsubscribe = dependencies.subscribe(reload);
    const poll = window.setInterval(reload, 2_000);
    return () => {
      active = false;
      queued = false;
      if (reloadRef.current === reload) reloadRef.current = null;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [acceptLoadedState, dependencies, token]);

  useEffect(() => {
    if (state.status !== 'active' || state.selectedMessage) return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    const millisecondsLeft = Math.max(0,
      Date.parse(state.sendUntil)
      - Date.parse(state.serverNow)
      - (Date.now() - syncedAt.current));
    const deadline = window.setTimeout(() => setClock(Date.now()), Math.ceil(millisecondsLeft));
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(deadline);
    };
  }, [state]);

  useEffect(() => {
    if (state.status !== 'finished') {
      resultsInFlight.current = false;
      reloadResultsRef.current = null;
      setResults(null);
      setResultsLoading(false);
      setResultsError('');
      return;
    }

    const generation = sessionGeneration.current;
    let active = true;
    const isCurrentSession = () => active && sessionGeneration.current === generation;
    const reloadResults = () => {
      if (!isCurrentSession() || resultsInFlight.current) return;
      resultsInFlight.current = true;
      setResultsLoading(true);
      setResultsError('');
      let request: Promise<BunkerV2ResultsReadModel | null>;
      try {
        request = dependencies.loadResults();
      } catch (loadError) {
        request = Promise.reject(loadError);
      }
      void Promise.resolve(request)
        .then((next) => {
          if (!isCurrentSession()) return;
          if (next?.status === 'completed') {
            resultsRef.current = next;
            setResults(next);
            setResultsError('');
            return;
          }
          setResultsError((current) => current || 'Итоги пока не готовы. Повторите загрузку через несколько секунд.');
        })
        .catch(() => {
          if (!isCurrentSession()) return;
          setResultsError(resultsRef.current
            ? 'Связь нестабильна. Последние загруженные итоги сохранены.'
            : 'Не удалось загрузить итоги. Проверьте связь и попробуйте ещё раз.');
        })
        .finally(() => {
          if (!isCurrentSession()) return;
          resultsInFlight.current = false;
          setResultsLoading(false);
        });
    };

    reloadResultsRef.current = reloadResults;
    reloadResults();
    return () => {
      active = false;
      resultsInFlight.current = false;
      if (reloadResultsRef.current === reloadResults) reloadResultsRef.current = null;
    };
  }, [dependencies, state.status, token]);

  const secondsLeft = state.status === 'active'
    ? Math.max(0, (
      Date.parse(state.sendUntil)
      - Date.parse(state.serverNow)
      - (clock - syncedAt.current)
    ) / 1_000)
    : 0;
  const canSend = state.status === 'active'
    && state.windowOpen
    && secondsLeft > 0
    && !state.selectedMessage
    && !submitting;
  const selectedOption = state.status === 'active'
    ? state.options.find((option) => option.key === selectedKey) ?? null
    : null;

  const transmit = async () => {
    if (!canSend || state.status !== 'active' || !selectedOption || submitInFlight.current) return;
    const generation = sessionGeneration.current;
    const submittedStage = state.stage;
    submitInFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await dependencies.submit(token, state.stage, selectedOption.key);
      if (sessionGeneration.current !== generation) return;
      requestEpoch.current += 1;
      submitBarrier.current = { stage: submittedStage };
      const current = stateRef.current;
      if (current.status === 'active' && current.stage === submittedStage) {
        acceptState({
          ...current,
          serverNow: result.serverNow,
          windowOpen: false,
          selectedMessage: result.message,
        });
      }
      setConfirming(false);
      void Promise.resolve(dependencies.broadcast()).catch(() => undefined);
      reloadRef.current?.();
    } catch {
      if (sessionGeneration.current === generation) {
        setError('Сигнал не передан. Проверьте связь и попробуйте ещё раз.');
      }
    } finally {
      if (sessionGeneration.current === generation) {
        submitInFlight.current = false;
        setSubmitting(false);
      }
    }
  };

  const content = (() => {
    if (state.status === 'idle') {
      return (
        <>
          <h1>СОСТАВ В ПУТИ</h1>
          <p>Канал открыт. Следующее окно передачи появится автоматически.</p>
        </>
      );
    }
    if (state.status === 'revealed') {
      return (
        <>
          <h1>СИГНАЛ ПРИНЯТ</h1>
          <p>Ворота открыты. Смотрите на общий экран.</p>
        </>
      );
    }
    if (state.status === 'finished') {
      return (
        <>
          <h1>МАРШРУТ ЗАВЕРШЁН</h1>
          {!results && resultsLoading && <p role="status">ЗАГРУЖАЕМ ИТОГИ…</p>}
          {results && <BunkerResultsPlayer model={results} />}
          {resultsError && (
            <div className="bunker-operator-panel__results-error" role="alert">
              <p>{resultsError}</p>
              <button
                type="button"
                disabled={resultsLoading}
                onClick={() => reloadResultsRef.current?.()}
              >
                {results ? 'ОБНОВИТЬ ИТОГИ' : 'ПОВТОРИТЬ ЗАГРУЗКУ ИТОГОВ'}
              </button>
            </div>
          )}
          {results && !resultsError && (
            <button
              className="bunker-operator-panel__results-refresh"
              type="button"
              disabled={resultsLoading}
              onClick={() => reloadResultsRef.current?.()}
            >
              {resultsLoading ? 'ОБНОВЛЯЕМ…' : 'ОБНОВИТЬ ИТОГИ'}
            </button>
          )}
        </>
      );
    }
    if (state.status === 'invalid_access') {
      return (
        <>
          <h1>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</h1>
          <p>Попросите организатора перевыдать персональную ссылку.</p>
        </>
      );
    }

    const sent = state.selectedMessage;
    return (
      <>
        <div className="bunker-operator-panel__mission">
          <span>ОКНО ПЕРЕДАЧИ · {state.stage.replace('_', ' ')}</span>
          <time dateTime={state.sendUntil}>{formatCountdown(secondsLeft)}</time>
        </div>
        {sent && (
          <div className="bunker-operator-panel__outcome" role="status" aria-live="polite">
            <strong>{sent.source === 'fallback' ? 'КАНАЛ ПЕРЕДАЛ РЕЗЕРВНОЕ СООБЩЕНИЕ' : 'СИГНАЛ ПЕРЕДАН'}</strong>
            <p>{sent.body}</p>
          </div>
        )}
        {!sent && (
          <>
            <h1>ВЫБЕРИТЕ СИГНАЛ</h1>
            <p>Передача атмосферная и не меняет правила миссии.</p>
          </>
        )}
        <div className="bunker-operator-panel__options" aria-label="Реплики оператора">
          {state.options.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={(sent?.optionKey ?? selectedKey) === option.key}
              disabled={!canSend}
              onClick={() => {
                setSelectedKey(option.key);
                setConfirming(true);
                setError('');
              }}
            >
              {option.body}
            </button>
          ))}
        </div>
        {!sent && !canSend && (
          <p className="bunker-operator-panel__expired" role="status">
            ОКНО ЗАКРЫТО · ОЖИДАЕМ РЕЗЕРВНЫЙ СИГНАЛ
          </p>
        )}
        {!sent && confirming && selectedOption && canSend && (
          <div className="bunker-operator-panel__confirmation">
            <strong>ПОДТВЕРДИТЕ ПЕРЕДАЧУ</strong>
            <p>{selectedOption.body}</p>
            <button type="button" disabled={submitting} onClick={() => void transmit()}>
              {submitting ? 'ПЕРЕДАЁМ…' : 'ПЕРЕДАТЬ В СОСТАВ'}
            </button>
          </div>
        )}
      </>
    );
  })();

  const showAnonymousPortrait = state.status === 'active' || state.status === 'idle';

  return (
    <main className="bunker-player-shell bunker-operator-shell">
      <section className="bunker-operator-panel" aria-label="Личный канал оператора BK-17">
        <header>
          <p>ОПЕРАТОР BK-17 · PRIVATE CHANNEL</p>
          <span aria-label="Статус канала">● КАНАЛ АКТИВЕН</span>
        </header>
        {showAnonymousPortrait && portraitAvailable && (
          <figure className="bunker-operator-panel__identity">
            <picture>
              <source srcSet="/images/bunker/story/liza-operator.avif" type="image/avif" />
              <img
                src="/images/bunker/story/liza-operator.webp"
                width={1122}
                height={1402}
                alt="Оператор BK-17 в диспетчерской"
                decoding="async"
                onError={() => setPortraitAvailable(false)}
              />
            </picture>
            <figcaption>АРХИВНЫЙ КАНАЛ · ЛИЧНОСТЬ СКРЫТА</figcaption>
          </figure>
        )}
        {content}
        {error && <p className="bunker-operator-panel__error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
