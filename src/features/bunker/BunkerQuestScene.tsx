import type { CSSProperties } from 'react';
import type { BunkerPhase } from './bunkerQuest.types';
import type { BunkerScreenState, BunkerScreenTeamState } from './bunker.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';
import type { BunkerGlobalGameState } from './bunkerSession.service';
import { MissionOneScreen, type MissionOneScreenReadModel } from './v2/MissionOneScreen';
import { bunkerStageLabel } from './v2/labels';

type ActiveBunkerScreen = Extract<BunkerScreenState, { status: 'active' }>;
type BunkerQuestSceneProps = { state: ActiveBunkerScreen; remainingSeconds: number; motionPreference?: 'full' | 'reduced'; missionOne?: MissionOneScreenReadModel; bunkerContractVersion?: 1 | 2 };
function formatTimer(seconds: number): string { const safe = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }
function phaseTitle(phase: BunkerPhase): string {
  switch (phase) { case 'dossier_1': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП I'; case 'dossier_2': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП II'; case 'mission_a': return 'КОМАНДНОЕ ЗАДАНИЕ'; case 'mission_b': return 'ОБЩЕЕ ЗАДАНИЕ'; case 'final': return 'ФИНАЛЬНЫЙ ДОСТУП'; case 'completed': return 'ДОСТУП ПОЛУЧЕН'; case 'emergency': return 'ЭКСТРЕННОЕ СООБЩЕНИЕ'; }
}
export function phaseForGlobalGameState(state: BunkerGlobalGameState | undefined, fallback: BunkerPhase): BunkerPhase {
  switch (state) {
    case 'LOBBY': case 'CHARACTERS_READY': return 'emergency';
    case 'MISSION_01': return 'dossier_1';
    case 'BREAK': case 'MISSION_02': return 'dossier_2';
    case 'MISSION_03': case 'MISSION_04': return 'mission_a';
    case 'MISSION_05': case 'MISSION_06': case 'STORY_BUNKER': return 'mission_b';
    case 'BREAK_BEFORE_FINAL': case 'FINAL_30': return 'final';
    case 'BUNKER_OPEN': case 'FINISHED': return 'completed';
    default: return fallback;
  }
}
function missionHeadline(state: ActiveBunkerScreen, phase: BunkerPhase): string {
  const mission = state.currentMission;
  if (!mission || !/^MISSION_\d{2}$/.test(mission.state)) return phaseTitle(phase);
  const plan = mission.plan;
  const objective = plan && !Array.isArray(plan) && typeof plan.objective === 'string' ? plan.objective.trim().toLocaleUpperCase('ru-RU') : '';
  const base = bunkerStageLabel(mission.state).toLocaleUpperCase('ru-RU');
  return objective ? `${base} · ${objective}` : base;
}
function teamComplete(team: BunkerScreenTeamState, phase: BunkerPhase): boolean { if (phase === 'mission_a') return team.missionAComplete; if (phase === 'mission_b' || phase === 'final' || phase === 'completed') return team.missionBComplete; return false; }
function progressLabel(state: ActiveBunkerScreen, phase: BunkerPhase): string | null { if (state.teams.length === 0) return null; if (phase === 'mission_a') return `${state.teams.filter((team) => team.missionAComplete).length} / ${state.teams.length} ГОТОВО`; if (phase === 'mission_b') return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ГОТОВО`; if (phase === 'final' || phase === 'completed') return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ФРАГМЕНТОВ`; return null; }
function sceneBackdrop(state: ActiveBunkerScreen, phase: BunkerPhase): BunkerAsset { if (phase === 'final' || phase === 'completed') return state.unlocked ? 'bunker-door-open' : 'bunker-door-closed'; if (phase === 'mission_a' || phase === 'mission_b') return 'tunnel-map-master'; return 'bunker-exterior'; }

export function BunkerQuestScene({ state, remainingSeconds, motionPreference = 'full', missionOne, bunkerContractVersion }: BunkerQuestSceneProps) {
  if (state.globalGameState === 'MISSION_01' && bunkerContractVersion !== 1) {
    if (!missionOne) return <section className="bunker-mission-one-screen" aria-label="Задание 1 · общий экран"><p className="bunker-quest-scene__empty" role="status">ЗАДАНИЕ 1 · ЛИШНИЙ ПАССАЖИР — ЗАГРУЖАЕМ ДАННЫЕ ВАГОНОВ…</p></section>;
    return <MissionOneScreen model={missionOne} />;
  }
  const phase = phaseForGlobalGameState(state.globalGameState, state.phase);
  const progress = progressLabel(state, phase); const arrived = remainingSeconds <= 0; const finalPhase = phase === 'final' || phase === 'completed';
  const hasAuthoritativeWagons = state.teams.length > 0; const characterCounts = state.characterCounts ?? { active: 0, saved: 0, excluded: 0 };
  const headline = arrived && finalPhase ? (state.unlocked ? 'ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН' : 'ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН') : missionHeadline(state, phase);
  return (
    <section className={`bunker-quest-scene bunker-quest-scene--${phase}`} aria-label="Бункер · общий экран" data-motion={motionPreference} data-phase={phase}>
      <BunkerResponsivePicture asset={sceneBackdrop(state, phase)} className="bunker-quest-scene__backdrop" testId="bunker-scene-backdrop" loading="eager" />
      {motionPreference === 'full' && <picture className="bunker-quest-scene__train-wipe" aria-hidden="true" data-testid="bunker-train-window-wipe"><source srcSet="/images/bunker/train-window-wipe.avif" type="image/avif" /><source srcSet="/images/bunker/train-window-wipe.webp" type="image/webp" /><img src="/images/bunker/train-window-wipe.png" alt="" width="2048" height="1152" decoding="async" /></picture>}
      <div className="bunker-quest-scene__grid" aria-hidden="true" />
      <header className="bunker-quest-scene__header"><div><p>ПОЕЗД ВИКТОРА · ПРОТОКОЛ БУНКЕРА · 30.08.2026</p><h1>{headline}</h1></div><strong>{formatTimer(remainingSeconds)}</strong></header>
      {(phase === 'dossier_1' || phase === 'dossier_2') && <div className="bunker-quest-scene__briefing"><span>ЛИЧНЫЕ ЭКРАНЫ АКТИВНЫ</span><strong>{phase === 'dossier_1' ? 'СВЕРЬТЕ ДАННЫЕ ВНУТРИ ВАГОНА' : 'ДОСЬЕ РАСКРЫТО · ГОТОВЬТЕСЬ К СЛЕДУЮЩЕМУ ЗАДАНИЮ'}</strong><p>Телефоны гостей синхронизированы с текущим этапом.</p></div>}
      {(phase === 'mission_a' || phase === 'mission_b') && <div className="bunker-quest-scene__mission"><div className="bunker-quest-scene__progress-heading"><span>СОСТОЯНИЕ ВАГОНОВ</span>{progress && <strong>{progress}</strong>}</div><p className="bunker-quest-scene__character-counts">ПЕРСОНАЖИ · {characterCounts.active} АКТИВНЫ · {characterCounts.saved} СПАСЕНЫ · {characterCounts.excluded} ИСКЛЮЧЕНЫ</p>{hasAuthoritativeWagons ? <div className="bunker-wagon-grid bunker-quest-scene__teams" data-count={state.teams.length} aria-label="Активные вагоны">{state.teams.map((team) => { const complete = teamComplete(team, phase); return <article key={team.carriageNumber} className={complete ? 'is-complete' : ''}><span>{String(team.carriageNumber).padStart(2, '0')}</span><strong>{team.label}</strong><i>{complete ? 'ГОТОВ' : 'В РАБОТЕ'}</i></article>; })}</div> : <p className="bunker-quest-scene__empty">ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ</p>}</div>}
      {finalPhase && <div className="bunker-quest-scene__final"><div className="bunker-quest-scene__progress-heading"><span>ФИНАЛЬНЫЙ ДОСТУП</span>{progress && <strong>{progress}</strong>}</div>{hasAuthoritativeWagons ? <div className="bunker-wagon-grid bunker-quest-scene__slots" data-count={state.teams.length} aria-label="Активные вагоны">{state.teams.map((team, index) => <article key={team.carriageNumber} className={team.missionBComplete ? 'is-open' : ''}><BunkerResponsivePicture asset="tunnel-map-master" className="bunker-map-fragment" testId="bunker-map-fragment" fragmentIndex={index} fragmentCount={state.teams.length} sizes={`${Math.ceil(100 / state.teams.length)}vw`} style={{ '--bunker-fragment-offset': `${index * -100}%`, '--bunker-fragment-width': `${state.teams.length * 100}%` } as CSSProperties} /><span>ВАГОН {String(team.carriageNumber).padStart(2, '0')}</span><strong>{team.missionBComplete ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</strong></article>)}</div> : <p className="bunker-quest-scene__empty">ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ</p>}{state.unlocked && remainingSeconds > 0 && <div className="bunker-quest-scene__unlock-state"><strong>ДОСТУП ПОЛУЧЕН</strong><span>ОЖИДАЕМ ПРИБЫТИЕ</span></div>}</div>}
      <footer><span>АРХИВ БУНКЕРА</span><span>СИСТЕМА · В СЕТИ</span></footer>
    </section>
  );
}
