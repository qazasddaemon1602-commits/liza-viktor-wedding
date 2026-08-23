import { useCallback, useEffect, useRef, useState } from 'react';
import type { BunkerOperatorStage } from './bunkerOperator.contract';
import type {
  LizaBunkerOperatorState,
  SubmitLizaBunkerOperatorResult,
} from './bunkerOperator.service';

export type LizaBunkerOperatorPanelDependencies = {
  load: (token: string) => Promise<LizaBunkerOperatorState>;
  submit: (
    token: string,
    stage: BunkerOperatorStage,
    optionKey: string,
  ) => Promise<SubmitLizaBunkerOperatorResult>;
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
  const [clock, setClock] = useState(() => Date.now());
  const syncedAt = useRef(Date.now());
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const submitInFlight = useRef(false);
  const queued = useRef(false);

  const acceptState = useCallback((next: LizaBunkerOperatorState) => {
    syncedAt.current = Date.now();
    setClock(Date.now());
    setState(next);
    setError('');
    if (
      next.status === 'invalid_access'
      || (next.status === 'idle' && !next.bunkerActive)
    ) onLeaveOperatorMode?.(next);
  }, [onLeaveOperatorMode]);

  const interactionIdentity = state.status === 'active'
    ? `${state.stage}:${state.selectedMessage?.id ?? 'open'}`
    : state.status;

  useEffect(() => {
    setSelectedKey(null);
    setConfirming(false);
  }, [interactionIdentity]);

  const reload = useCallback(() => {
    if (inFlight.current) {
      queued.current = true;
      return inFlight.current;
    }
    const request = dependencies.load(token)
      .then((next) => {
        if (mounted.current) acceptState(next);
      })
      .catch(() => {
        if (mounted.current) setError('Связь нестабильна. Последний принятый сигнал сохранён.');
      })
      .finally(() => {
        inFlight.current = null;
        if (mounted.current && queued.current) {
          queued.current = false;
          reload();
        }
      });
    inFlight.current = request;
    return request;
  }, [acceptState, dependencies, token]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = dependencies.subscribe(reload);
    const poll = window.setInterval(reload, 2_000);
    return () => {
      mounted.current = false;
      queued.current = false;
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [dependencies, reload]);

  useEffect(() => {
    if (state.status !== 'active' || state.selectedMessage) return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state]);

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
    submitInFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await dependencies.submit(token, state.stage, selectedOption.key);
      if (!mounted.current) return;
      syncedAt.current = Date.now();
      setState({ ...state, serverNow: result.serverNow, windowOpen: false, selectedMessage: result.message });
      setConfirming(false);
      void Promise.resolve(dependencies.broadcast()).catch(() => undefined);
    } catch {
      if (mounted.current) setError('Сигнал не передан. Проверьте связь и попробуйте ещё раз.');
    } finally {
      submitInFlight.current = false;
      if (mounted.current) setSubmitting(false);
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
          <p>Состав прибыл. Финальная запись сохранена в архиве.</p>
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

  return (
    <main className="bunker-player-shell bunker-operator-shell">
      <section className="bunker-operator-panel" aria-label="Личный канал оператора BK-17">
        <header>
          <p>ОПЕРАТОР BK-17 · PRIVATE CHANNEL</p>
          <span aria-label="Статус канала">● КАНАЛ АКТИВЕН</span>
        </header>
        {content}
        {error && <p className="bunker-operator-panel__error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
