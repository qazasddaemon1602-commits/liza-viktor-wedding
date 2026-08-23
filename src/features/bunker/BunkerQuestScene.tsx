import type { CSSProperties } from 'react';
import type { BunkerPhase } from './bunkerQuest.types';
import type { BunkerScreenState, BunkerScreenTeamState } from './bunker.service';
import { BunkerResponsivePicture, type BunkerAsset } from './BunkerResponsivePicture';
import type { BunkerGlobalGameState } from './bunkerSession.service';
import { MissionOneScreen, type MissionOneScreenReadModel } from './v2/MissionOneScreen';
import { MissionTwoScreen, type MissionTwoScreenModel } from './v2/MissionTwoScreen';
import { MissionThreeScreen, type MissionThreeScreenModel } from './v2/MissionThreeScreen';
import { MissionFourScreen, type MissionFourScreenModel } from './v2/MissionFourScreen';
import { MissionFiveScreen, type MissionFiveScreenModel } from './v2/MissionFiveScreen';
import { MissionSixScreen, type MissionSixScreenModel } from './v2/MissionSixScreen';
import {
  getBunkerMissionContent,
  type BunkerMissionKey,
} from './v2/content/missionContent';

type ActiveBunkerScreen = Extract<BunkerScreenState, { status: 'active' }>;

type BunkerQuestSceneProps = {
  state: ActiveBunkerScreen;
  remainingSeconds: number;
  motionPreference?: 'full' | 'reduced';
  missionOne?: MissionOneScreenReadModel;
  missionTwo?: MissionTwoScreenModel;
  missionThree?: MissionThreeScreenModel;
  missionFour?: MissionFourScreenModel;
  missionFive?: MissionFiveScreenModel;
  missionSix?: MissionSixScreenModel;
  bunkerContractVersion?: 1 | 2;
};

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function phaseTitle(phase: BunkerPhase): string {
  switch (phase) {
    case 'dossier_1': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП I';
    case 'dossier_2': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП II';
    case 'mission_a': return 'КОМАНДНАЯ ЗАДАЧА A';
    case 'mission_b': return 'КОМАНДНАЯ ЗАДАЧА B';
    case 'final': return 'ФИНАЛЬНЫЙ ДОСТУП';
    case 'completed': return 'ДОСТУП ПОЛУЧЕН';
    case 'emergency': return 'ЭКСТРЕННОЕ СООБЩЕНИЕ';
  }
}

export function phaseForGlobalGameState(
  state: BunkerGlobalGameState | undefined,
  fallback: BunkerPhase,
): BunkerPhase {
  switch (state) {
    case 'LOBBY':
    case 'CHARACTERS_READY': return 'emergency';
    case 'MISSION_01': return 'dossier_1';
    case 'BREAK':
    case 'MISSION_02': return 'dossier_2';
    case 'MISSION_03':
    case 'MISSION_04': return 'mission_a';
    case 'MISSION_05':
    case 'MISSION_06':
    case 'STORY_BUNKER': return 'mission_b';
    case 'BREAK_BEFORE_FINAL':
    case 'FINAL_30': return 'final';
    case 'BUNKER_OPEN':
    case 'FINISHED': return 'completed';
    default: return fallback;
  }
}

function missionHeadline(state: ActiveBunkerScreen, phase: BunkerPhase): string {
  const mission = state.currentMission;
  if (!mission || !/^MISSION_\d{2}$/.test(mission.state)) return phaseTitle(phase);
  const number = mission.state.slice(-2);
  const plan = mission.plan;
  const objective = plan && !Array.isArray(plan) && typeof plan.objective === 'string'
    ? plan.objective.trim().toLocaleUpperCase('ru-RU')
    : '';
  return objective ? `МИССИЯ ${number} · ${objective}` : `МИССИЯ ${number}`;
}

function headlineDensity(headline: string): 'short' | 'medium' | 'long' {
  if (headline.length > 84) return 'long';
  if (headline.length > 52) return 'medium';
  return 'short';
}

function isGlobalMissionState(value: string | null | undefined): boolean {
  return /^MISSION_0[1-6]$/.test(value ?? '');
}

function teamComplete(
  team: BunkerScreenTeamState,
  phase: BunkerPhase,
  useCurrentMissionProgress: boolean,
): boolean {
  if (useCurrentMissionProgress) return team.currentMissionComplete === true;
  if (phase === 'mission_a') return team.missionAComplete;
  if (phase === 'mission_b' || phase === 'final' || phase === 'completed') {
    return team.missionBComplete;
  }
  return false;
}

function progressLabel(
  state: ActiveBunkerScreen,
  phase: BunkerPhase,
  useCurrentMissionProgress: boolean,
): string | null {
  if (state.teams.length === 0) return null;
  if (useCurrentMissionProgress) {
    return `${state.teams.filter((team) => team.currentMissionComplete === true).length} / ${state.teams.length} ГОТОВО`;
  }
  if (phase === 'mission_a') {
    return `${state.teams.filter((team) => team.missionAComplete).length} / ${state.teams.length} ГОТОВО`;
  }
  if (phase === 'mission_b') {
    return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ГОТОВО`;
  }
  if (phase === 'final' || phase === 'completed') {
    return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ФРАГМЕНТОВ`;
  }
  return null;
}

function sceneBackdrop(state: ActiveBunkerScreen, phase: BunkerPhase): BunkerAsset {
  if (phase === 'final' || phase === 'completed') {
    return state.unlocked ? 'bunker-door-open' : 'bunker-door-closed';
  }
  if (phase === 'mission_a' || phase === 'mission_b') return 'tunnel-map-master';
  return 'bunker-exterior';
}

function missionArtwork(key: BunkerMissionKey, unlocked: boolean): BunkerAsset {
  switch (key) {
    case 'M01': return 'evidence-01';
    case 'M02': return 'evidence-02';
    case 'M03': return 'evidence-03';
    case 'M04': return 'evidence-04';
    case 'M05': return 'evidence-05';
    case 'M06': return 'evidence-06';
    case 'FINAL': return unlocked ? 'bunker-door-open' : 'bunker-door-closed';
  }
}

export function BunkerQuestScene({
  state,
  remainingSeconds,
  motionPreference = 'full',
  missionOne,
  missionTwo,
  missionThree,
  missionFour,
  missionFive,
  missionSix,
  bunkerContractVersion,
}: BunkerQuestSceneProps) {
  // Preserve the latest M01 fallback from main: while the V2 contract projection
  // is still loading, do not flash the unrelated legacy dossier screen.
  if (state.globalGameState === 'MISSION_01' && bunkerContractVersion === 2) {
    return missionOne ? (
      <MissionOneScreen model={missionOne} />
    ) : (
      <section className="bunker-mission-one-screen" aria-label="Задание 1 · общий экран">
        <p className="bunker-quest-scene__empty" role="status">
          ЗАДАНИЕ 1 · ЛИШНИЙ ПАССАЖИР — ЗАГРУЖАЕМ ДАННЫЕ ВАГОНОВ…
        </p>
      </section>
    );
  }

  // Later V2 stages switch only on an explicit V2 contract. If the contract
  // read is temporarily unavailable, a legacy run must keep its legacy screen.
  if (state.globalGameState === 'MISSION_02' && bunkerContractVersion === 2) {
    return missionTwo ? <MissionTwoScreen model={missionTwo} /> : (
      <section className="bunker-v2-screen" aria-label="Задание 2 · общий экран">
        <h1>ЧЁРНЫЙ ЯЩИК</h1>
        <p role="status">ЗАГРУЖАЕМ ПРОГРЕСС ВАГОНОВ…</p>
      </section>
    );
  }
  if (state.globalGameState === 'MISSION_03' && bunkerContractVersion === 2) {
    return missionThree ? <MissionThreeScreen model={missionThree} /> : (
      <section className="bunker-v2-screen" aria-label="Задание 3 · общий экран">
        <h1>АВАРИЙНЫЙ ЗАПАС</h1>
        <p role="status">ЗАГРУЖАЕМ ПРОГРЕСС ВАГОНОВ…</p>
      </section>
    );
  }
  if (state.globalGameState === 'MISSION_04' && bunkerContractVersion === 2) {
    return missionFour ? <MissionFourScreen model={missionFour} /> : (
      <section className="bunker-v2-screen" aria-label="Задание 4 · общий экран">
        <p>МИССИЯ 04</p>
        <h1>МЕЖВАГОННАЯ СВЯЗЬ</h1>
        <p role="status">ЗАГРУЖАЕМ ПРОГРЕСС ВАГОНОВ…</p>
      </section>
    );
  }
  if (state.globalGameState === 'MISSION_05' && bunkerContractVersion === 2) {
    return missionFive ? <MissionFiveScreen model={missionFive} /> : (
      <section className="bunker-v2-screen" aria-label="Задание 5 · общий экран">
        <h1>ОДИН ШАНС</h1>
        <p role="status">ЗАГРУЖАЕМ ПРОГРЕСС ВАГОНОВ…</p>
      </section>
    );
  }
  if (state.globalGameState === 'MISSION_06' && bunkerContractVersion === 2) {
    return missionSix ? <MissionSixScreen model={missionSix} /> : (
      <section className="bunker-v2-screen bunker-v2-screen--m06" aria-label="Задание 6 · общий экран">
        <h1>ОБЩИЙ ПРОТОКОЛ</h1>
        <p role="status">ЗАГРУЖАЕМ ПРОГРЕСС ВАГОНОВ…</p>
      </section>
    );
  }

  const phase = phaseForGlobalGameState(state.globalGameState, state.phase);
  const useCurrentMissionProgress = isGlobalMissionState(
    state.globalGameState ?? state.currentMission?.state,
  );
  const progress = progressLabel(state, phase, useCurrentMissionProgress);
  const arrived = remainingSeconds <= 0;
  const finalPhase = phase === 'final' || phase === 'completed';
  const hasAuthoritativeWagons = state.teams.length > 0;
  const characterCounts = state.characterCounts ?? { active: 0, saved: 0, excluded: 0 };

  const headline = arrived && finalPhase
    ? state.unlocked
      ? 'ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН'
      : 'ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН'
    : missionHeadline(state, phase);
  const density = headlineDensity(headline);
  const missionContent = getBunkerMissionContent(
    state.currentMission?.id ?? state.globalGameState,
  );

  return (
    <section
      className={`bunker-quest-scene bunker-quest-scene--${phase}`}
      aria-label="Бункер · экран квеста"
      data-motion={motionPreference}
      data-phase={phase}
      data-headline-density={density}
      data-mission-key={missionContent?.key}
    >
      <BunkerResponsivePicture
        asset={sceneBackdrop(state, phase)}
        className="bunker-quest-scene__backdrop"
        testId="bunker-scene-backdrop"
        loading="eager"
      />
      {motionPreference === 'full' && (
        <picture
          className="bunker-quest-scene__train-wipe"
          aria-hidden="true"
          data-testid="bunker-train-window-wipe"
        >
          <source srcSet="/images/bunker/train-window-wipe.avif" type="image/avif" />
          <source srcSet="/images/bunker/train-window-wipe.webp" type="image/webp" />
          <img
            src="/images/bunker/train-window-wipe.png"
            alt=""
            width="2048"
            height="1152"
            decoding="async"
          />
        </picture>
      )}
      <div className="bunker-quest-scene__grid" aria-hidden="true" />
      <header className="bunker-quest-scene__header">
        <div>
          <p>ПОЕЗД ВИКТОРА · ПРОТОКОЛ БУНКЕРА · 30.08.2026</p>
          <h1>{headline}</h1>
        </div>
        <strong>{formatTimer(remainingSeconds)}</strong>
      </header>

      <div className="bunker-quest-scene__body">
        {missionContent && (
        <section className="bunker-quest-scene__story" aria-label="Вступление к миссии">
          <BunkerResponsivePicture
            asset={missionArtwork(missionContent.key, state.unlocked)}
            className="bunker-quest-scene__story-artwork"
            testId="bunker-mission-artwork"
            sizes="(max-width: 960px) 36vw, 30vw"
            loading="eager"
          />
          <div>
            <span>{missionContent.intro.eyebrow}</span>
            <h2>{missionContent.title}</h2>
            <strong>{missionContent.intro.headline}</strong>
            <p>{missionContent.tv.instruction}</p>
          </div>
        </section>
        )}

        {(phase === 'dossier_1' || phase === 'dossier_2') && !useCurrentMissionProgress && (
        <div className="bunker-quest-scene__briefing">
          <span>ЛИЧНЫЕ ТЕРМИНАЛЫ АКТИВНЫ</span>
          <strong>
            {phase === 'dossier_1'
              ? 'СВЕРЬТЕ ПЕРВЫЕ ДАННЫЕ ВНУТРИ ВАГОНА'
              : 'ДОСЬЕ РАСКРЫТО · ГОТОВЬТЕСЬ К КОМАНДНОЙ ЗАДАЧЕ'}
          </strong>
          <p>Телефоны гостей синхронизированы с текущим этапом.</p>
        </div>
        )}

        {(useCurrentMissionProgress || phase === 'mission_a' || phase === 'mission_b') && (
        <div className="bunker-quest-scene__mission">
          <div className="bunker-quest-scene__progress-heading">
            <span>СОСТОЯНИЕ ВАГОНОВ</span>
            {progress && <strong>{progress}</strong>}
          </div>
          <p className="bunker-quest-scene__character-counts">
            ПЕРСОНАЖИ · {characterCounts.active} АКТИВНЫ · {characterCounts.saved} СПАСЕНЫ · {characterCounts.excluded} ИСКЛЮЧЁН
          </p>
          {hasAuthoritativeWagons ? (
            <div
              className="bunker-wagon-grid bunker-quest-scene__teams"
              data-count={state.teams.length}
              aria-label="Активные вагоны"
            >
              {state.teams.map((team) => {
                const complete = teamComplete(team, phase, useCurrentMissionProgress);
                return (
                  <article key={team.carriageNumber} className={complete ? 'is-complete' : ''}>
                    <span>{String(team.carriageNumber).padStart(2, '0')}</span>
                    <strong>{team.label}</strong>
                    <i>{complete ? 'ГОТОВ' : 'В РАБОТЕ'}</i>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="bunker-quest-scene__empty">ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ</p>
          )}
        </div>
        )}

        {finalPhase && (
        <div className="bunker-quest-scene__final">
          <div className="bunker-quest-scene__progress-heading">
            <span>КОНТУР ФИНАЛЬНОГО ДОСТУПА</span>
            {progress && <strong>{progress}</strong>}
          </div>
          {hasAuthoritativeWagons ? (
            <div
              className="bunker-wagon-grid bunker-quest-scene__slots"
              data-count={state.teams.length}
              aria-label="Активные вагоны"
            >
              {state.teams.map((team, index) => (
                <article key={team.carriageNumber} className={team.missionBComplete ? 'is-open' : ''}>
                  <BunkerResponsivePicture
                    asset="tunnel-map-master"
                    className="bunker-map-fragment"
                    testId="bunker-map-fragment"
                    fragmentIndex={index}
                    fragmentCount={state.teams.length}
                    sizes={`${Math.ceil(100 / state.teams.length)}vw`}
                    style={{
                      '--bunker-fragment-offset': `${index * -100}%`,
                      '--bunker-fragment-width': `${state.teams.length * 100}%`,
                    } as CSSProperties}
                  />
                  <span>ВАГОН {String(team.carriageNumber).padStart(2, '0')}</span>
                  <strong>{team.missionBComplete ? 'OPEN' : 'LOCKED'}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className="bunker-quest-scene__empty">ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ</p>
          )}
          {state.unlocked && remainingSeconds > 0 && (
            <div className="bunker-quest-scene__unlock-state">
              <strong>ДОСТУП ПОЛУЧЕН</strong>
              <span>ОЖИДАЕМ ПРИБЫТИЕ</span>
            </div>
          )}
        </div>
        )}
      </div>

      <footer>
        <span>АРХИВ БУНКЕРА</span>
        <span>СИСТЕМА · В СЕТИ</span>
      </footer>
    </section>
  );
}
