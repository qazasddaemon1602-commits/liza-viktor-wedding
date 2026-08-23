import { useEffect, useMemo, useState } from 'react';
import type { AdminDashboard } from '../admin.service';
import {
  EVENT_HOST_CUES,
  type EventHostCue,
  type EventHostCueId,
} from './eventHostContent';

const STORAGE_KEY = 'event.hostRunbook.v1';

type StoredRunbookProgress = {
  version: 1;
  events: Record<string, EventHostCueId[]>;
};

type EventHostRunbookProps = {
  dashboard: AdminDashboard;
};

function emptyProgress(): StoredRunbookProgress {
  return { version: 1, events: {} };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeCompleted(value: unknown): EventHostCueId[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(value.filter((id): id is string => typeof id === 'string'));
  return EVENT_HOST_CUES.map((cue) => cue.id).filter((id) => requested.has(id));
}

function readProgress(): StoredRunbookProgress {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<StoredRunbookProgress> | null;
    if (!parsed || parsed.version !== 1 || !isPlainRecord(parsed.events)) {
      return emptyProgress();
    }
    const events: Record<string, EventHostCueId[]> = {};
    for (const [eventId, completed] of Object.entries(parsed.events)) {
      if (Array.isArray(completed)) events[eventId] = normalizeCompleted(completed);
    }
    return { version: 1, events };
  } catch {
    return emptyProgress();
  }
}

function completedForEvent(eventId: string): EventHostCueId[] {
  return normalizeCompleted(readProgress().events[eventId]);
}

function saveCompleted(eventId: string, completed: EventHostCueId[]) {
  if (typeof window === 'undefined') return;
  try {
    const progress = readProgress();
    progress.events[eventId] = normalizeCompleted(completed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Host progress remains usable in memory when privacy mode or quota blocks storage.
  }
}

function cueFromActiveModule(dashboard: AdminDashboard, completed: Set<EventHostCueId>): EventHostCueId | null {
  const runtime = `${dashboard.state?.currentModule ?? ''} ${dashboard.state?.screenMode ?? ''}`.toLowerCase();
  if (runtime.includes('premiere')) return 'premiere';
  if (runtime.includes('mortal_kombat') || runtime.includes('mortal-kombat') || /\bmk\b/.test(runtime)) {
    return 'mortal-kombat';
  }
  if (runtime.includes('bunker')) {
    return (['bunker-intro', 'bunker-missions', 'bunker-final'] as EventHostCueId[])
      .find((id) => !completed.has(id)) ?? 'bunker-final';
  }
  if (runtime.includes('final_five') || runtime.includes('final-five')) return 'final-five';
  if (runtime.includes('quiz')) return 'quiz';
  return null;
}

export function suggestEventHostCue(
  dashboard: AdminDashboard,
  completedIds: EventHostCueId[],
): EventHostCueId {
  const completed = new Set(completedIds);
  const liveHint = cueFromActiveModule(dashboard, completed);
  if (liveHint && !completed.has(liveHint)) return liveHint;
  if (liveHint) {
    const liveIndex = EVENT_HOST_CUES.findIndex((cue) => cue.id === liveHint);
    const laterCue = EVENT_HOST_CUES.slice(liveIndex + 1).find((cue) => !completed.has(cue.id));
    if (laterCue) return laterCue.id;
  }
  return EVENT_HOST_CUES.find((cue) => !completed.has(cue.id))?.id ?? 'epilogue';
}

function statusHint(cue: EventHostCue, dashboard: AdminDashboard): string {
  const enabledCarriages = dashboard.carriages.filter((carriage) => carriage.enabled).length;
  const liveModule = dashboard.state?.currentModule ?? 'idle';
  const liveScreen = dashboard.state?.screenMode ?? 'idle';

  switch (cue.id) {
    case 'arrival':
    case 'registration':
      return `Регистрация: ${dashboard.guests.length} из примерно ${dashboard.event.expectedGuestCount} · ${dashboard.event.registrationOpen ? 'открыта' : 'закрыта'}.`;
    case 'carriage-assignment':
      return `Состав: ${dashboard.event.compositionLocked ? 'зафиксирован' : 'ещё не зафиксирован'} · активных вагонов: ${enabledCarriages}.`;
    case 'premiere':
      return `Экран: ${liveModule} / ${liveScreen}. Подробный статус — в модуле премьеры ниже.`;
    case 'quiz':
      return `Экран: ${liveModule} / ${liveScreen}. Вопросы и ответы проверяйте в модуле квиза ниже.`;
    case 'final-five':
      return `Экран: ${liveModule} / ${liveScreen}. Ответы пары проверяйте в модуле финальной пятёрки ниже.`;
    case 'mortal-kombat':
      return `Экран: ${liveModule} / ${liveScreen}. Подробный статус — в модуле турнира ниже.`;
    case 'bunker-intro':
    case 'bunker-missions':
    case 'bunker-final':
      return `Экран: ${liveModule} / ${liveScreen}. Авторитетный прогресс и 13-шаговый сценарий находятся в панели Бункера ниже.`;
    case 'epilogue':
      return `Экран: ${liveModule} / ${liveScreen}. Результаты остаются на сервере; эта отметка завершения только локальная.`;
  }
}

type CueCardProps = {
  cue: EventHostCue;
  dashboard: AdminDashboard;
  completed: boolean;
  current?: boolean;
  onToggle: (cueId: EventHostCueId) => void;
};

function CueCard({ cue, dashboard, completed, current = false, onToggle }: CueCardProps) {
  return (
    <article
      className={`event-host-cue${current ? ' event-host-cue--current' : ''}${completed ? ' event-host-cue--complete' : ''}`}
      aria-label={current ? 'Текущий этап сценария' : undefined}
      aria-current={current ? 'step' : undefined}
    >
      <header className="event-host-cue__header">
        <div>
          <p className="eyebrow">{current ? 'СЕЙЧАС ПО СЦЕНАРИЮ · ' : ''}{cue.eyebrow}</p>
          <h3>{cue.title}</h3>
        </div>
        <span className="event-host-cue__duration">{cue.duration}</span>
      </header>

      <p className="event-host-cue__status">{statusHint(cue, dashboard)}</p>

      <div className="event-host-cue__grid">
        <section>
          <h4>ПЕРЕД НАЧАЛОМ</h4>
          <ul>{cue.prerequisites.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
        <section className="event-host-cue__read">
          <h4>ПРОЧИТАТЬ ДОСЛОВНО</h4>
          {cue.read.map((line) => <p key={line}>«{line}»</p>)}
        </section>
        <section>
          <h4>МОЖНО ИМПРОВИЗИРОВАТЬ</h4>
          <ul>{cue.improvise.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
        <section>
          <h4>ТЕХНИЧЕСКОЕ ДЕЙСТВИЕ</h4>
          <ul>{cue.technical.map((line) => <li key={line}>{line}</li>)}</ul>
          {cue.moduleHref && cue.moduleLabel && <a href={cue.moduleHref}>{cue.moduleLabel}</a>}
        </section>
        {cue.doNotReveal && (
          <section className="event-host-cue__guard">
            <h4>НЕ РАСКРЫВАТЬ РАНЬШЕ</h4>
            <ul>{cue.doNotReveal.map((line) => <li key={line}>{line}</li>)}</ul>
          </section>
        )}
        <section className="event-host-cue__next">
          <h4>ЧТО ДАЛЬШЕ</h4>
          <p>{cue.next}</p>
        </section>
      </div>

      <button
        type="button"
        className="event-host-cue__complete"
        aria-pressed={completed}
        onClick={() => onToggle(cue.id)}
      >
        {completed ? '✓ ЭТАП ВЫПОЛНЕН · ОТМЕНИТЬ' : `ОТМЕТИТЬ ЭТАП «${cue.title}» ВЫПОЛНЕННЫМ`}
      </button>
    </article>
  );
}

export function EventHostRunbook({ dashboard }: EventHostRunbookProps) {
  const [completedIds, setCompletedIds] = useState<EventHostCueId[]>(
    () => completedForEvent(dashboard.event.id),
  );
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    setCompletedIds(completedForEvent(dashboard.event.id));
  }, [dashboard.event.id]);

  const currentId = useMemo(
    () => suggestEventHostCue(dashboard, completedIds),
    [completedIds, dashboard],
  );
  const currentCue = EVENT_HOST_CUES.find((cue) => cue.id === currentId) ?? EVENT_HOST_CUES[0];

  const toggleCompleted = (cueId: EventHostCueId) => {
    const next = completedIds.includes(cueId)
      ? completedIds.filter((id) => id !== cueId)
      : normalizeCompleted([...completedIds, cueId]);
    saveCompleted(dashboard.event.id, next);
    setCompletedIds(next);
  };

  return (
    <section className="event-host-runbook" aria-label="Общий сценарий мероприятия">
      <header className="event-host-runbook__heading">
        <div>
          <p className="eyebrow">РЕЖИССЁРСКИЙ ПУЛЬТ · ОТ ВСТРЕЧИ ДО ЭПИЛОГА</p>
          <h2>СЦЕНАРИЙ ВСЕГО МЕРОПРИЯТИЯ</h2>
        </div>
        <span>{completedIds.length} / {EVENT_HOST_CUES.length} ЭТАПОВ</span>
      </header>
      <p className="event-host-runbook__notice">
        Это шпаргалка ведущего. Галочки хранятся только на этом устройстве и никогда не запускают игровые команды.
      </p>

      <div className="event-host-runbook__current">
        <CueCard
          cue={currentCue}
          dashboard={dashboard}
          completed={completedIds.includes(currentCue.id)}
          current
          onToggle={toggleCompleted}
        />
      </div>

      <details
        className="event-host-runbook__timeline"
        onToggle={(event) => setTimelineOpen(event.currentTarget.open)}
      >
        <summary>ПОЛНЫЙ ТАЙМЛАЙН · {EVENT_HOST_CUES.length} ЭТАПОВ</summary>
        {timelineOpen && (
          <ol aria-label="Полный таймлайн мероприятия">
            {EVENT_HOST_CUES.map((cue, index) => (
              <li key={cue.id}>
                <span className="event-host-runbook__number">{String(index + 1).padStart(2, '0')}</span>
                <CueCard
                  cue={cue}
                  dashboard={dashboard}
                  completed={completedIds.includes(cue.id)}
                  onToggle={toggleCompleted}
                />
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
