import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { BunkerEmergencyScene } from './BunkerEmergencyScene';
import { BunkerQuestScene, phaseForGlobalGameState } from './BunkerQuestScene';
import { createBunkerAudioController, type BunkerAudioController } from './bunkerAudio';
import { setBunkerPresentationProtected } from './bunkerProtection';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';
import { getBunkerScreenState, type BunkerRpcClient, type BunkerScreenState } from './bunker.service';
import { getMissionOneScreenReadModel, type MissionOneRpcClient, type MissionOneScreenReadModel as M01 } from './v2/m01.service';
import type { MissionOneScreenReadModel } from './v2/MissionOneScreen';
import { getMissionTwoScreenReadModel, type MissionTwoScreenReadModel as M02 } from './v2/m02.service';
import type { MissionTwoScreenModel } from './v2/MissionTwoScreen';
import { getMissionThreeScreenReadModel, type MissionThreeScreenReadModel as M03 } from './v2/m03.service';
import type { MissionThreeScreenModel } from './v2/MissionThreeScreen';
import { getMissionFourScreenReadModel, type MissionFourScreenReadModel as M04 } from './v2/m04.service';
import type { MissionFourScreenModel } from './v2/MissionFourScreen';
import { getMissionFiveScreenReadModel, type MissionFiveScreenReadModel as M05 } from './v2/m05.service';
import type { MissionFiveScreenModel } from './v2/MissionFiveScreen';
import { getMissionSixScreenReadModel, type MissionSixScreenReadModel as M06 } from './v2/m06.service';
import type { MissionSixScreenModel } from './v2/MissionSixScreen';
import { getUnknownPassengerScreenReadModel, type UnknownPassengerScreenReadModel } from './v2/unknownPassenger.service';
import { UnknownPassengerScreen, type UnknownPassengerScreenModel } from './v2/UnknownPassengerScreen';

export type BunkerScreenGuardDependencies = {
  load: () => Promise<BunkerScreenState>;
  loadMissionOne?: () => Promise<M01>;
  loadMissionTwo?: () => Promise<M02>;
  loadMissionThree?: () => Promise<M03>;
  loadMissionFour?: () => Promise<M04>;
  loadMissionFive?: () => Promise<M05>;
  loadMissionSix?: () => Promise<M06>;
  loadUnknownPassenger?: () => Promise<UnknownPassengerScreenReadModel>;
  subscribe?: (callback: () => void) => () => void;
  audio?: BunkerAudioController;
};

type Props = { eventSlug?: string; dependencies?: BunkerScreenGuardDependencies; children: ReactNode };
type Timed<T> = { model: T; receivedAt: number };

function browserDependencies(eventSlug: string): BunkerScreenGuardDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpc = client as unknown as BunkerRpcClient & MissionOneRpcClient;
    const realtime = client as unknown as BunkerRealtimeClient;
    return {
      load: () => getBunkerScreenState(rpc, eventSlug),
      loadMissionOne: () => getMissionOneScreenReadModel(rpc, eventSlug),
      loadMissionTwo: () => getMissionTwoScreenReadModel(rpc, eventSlug),
      loadMissionThree: () => getMissionThreeScreenReadModel(rpc, eventSlug),
      loadMissionFour: () => getMissionFourScreenReadModel(rpc, eventSlug),
      loadMissionFive: () => getMissionFiveScreenReadModel(rpc, eventSlug),
      loadMissionSix: () => getMissionSixScreenReadModel(rpc, eventSlug),
      loadUnknownPassenger: () => getUnknownPassengerScreenReadModel(rpc, eventSlug),
      subscribe: (callback) => subscribeToBunkerRefresh(realtime, eventSlug, callback),
      audio: createBunkerAudioController(),
    };
  } catch { return null; }
}

function rem(deadline: string, serverNow: string, receivedAt: number, now: number) {
  return Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(serverNow)) / 1000 - (now - receivedAt) / 1000));
}
function m1(value: Timed<Extract<M01, { status: 'active' }>> | null, now: number): MissionOneScreenReadModel | undefined {
  return value ? { title: value.model.title, publicSummary: value.model.publicSummary, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), wagons: value.model.wagons } : undefined;
}
function m2(value: Timed<Extract<M02, { status: 'active' | 'completed' }>> | null, now: number): MissionTwoScreenModel | undefined {
  return value ? { title: value.model.title, subtitle: value.model.subtitle, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), wagons: value.model.wagons } : undefined;
}
function m3(value: Timed<Extract<M03, { status: 'active' | 'completed' }>> | null, now: number): MissionThreeScreenModel | undefined {
  return value ? { title: value.model.title, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), wagons: value.model.wagons } : undefined;
}
function m4(value: Timed<Extract<M04, { status: 'active' | 'completed' }>> | null, now: number): MissionFourScreenModel | undefined {
  return value ? { title: value.model.title, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), groups: value.model.groups } : undefined;
}
function m5(value: Timed<Extract<M05, { status: 'active' | 'completed' }>> | null, now: number): MissionFiveScreenModel | undefined {
  return value ? { title: value.model.title, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), wagons: value.model.wagons } : undefined;
}
function m6(value: Timed<Extract<M06, { status: 'active' | 'completed' }>> | null, now: number): MissionSixScreenModel | undefined {
  return value ? { title: value.model.title, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now), fragmentsRevealed: value.model.fragmentsRevealed, fragmentsTotal: value.model.fragmentsTotal, wagons: value.model.wagons } : undefined;
}
function story(value: Timed<Extract<UnknownPassengerScreenReadModel, { status: 'active' }>> | null, now: number): UnknownPassengerScreenModel | undefined {
  return value ? { title: value.model.title, dossierId: value.model.dossierId, sector: value.model.sector, remainingSeconds: rem(value.model.deadlineAt, value.model.serverNow, value.receivedAt, now) } : undefined;
}
function stateRemaining(state: Extract<BunkerScreenState, { status: 'active' }>, now: number, offset: number) {
  const started = Date.parse(state.startedAt);
  return Number.isFinite(started) ? Math.max(0, Math.ceil(state.durationSeconds - (now + offset - started) / 1000)) : state.remainingSeconds;
}

export function BunkerScreenGuard({ eventSlug = 'liza-viktor', dependencies, children }: Props) {
  const [browserDeps, setBrowserDeps] = useState<BunkerScreenGuardDependencies | null>(null);
  const deps = dependencies ?? browserDeps;
  const [state, setState] = useState<BunkerScreenState | null>(null);
  const [one, setOne] = useState<Timed<Extract<M01, { status: 'active' }>> | null>(null);
  const [two, setTwo] = useState<Timed<Extract<M02, { status: 'active' | 'completed' }>> | null>(null);
  const [three, setThree] = useState<Timed<Extract<M03, { status: 'active' | 'completed' }>> | null>(null);
  const [four, setFour] = useState<Timed<Extract<M04, { status: 'active' | 'completed' }>> | null>(null);
  const [five, setFive] = useState<Timed<Extract<M05, { status: 'active' | 'completed' }>> | null>(null);
  const [six, setSix] = useState<Timed<Extract<M06, { status: 'active' | 'completed' }>> | null>(null);
  const [unknownPassenger, setUnknownPassenger] = useState<Timed<Extract<UnknownPassengerScreenReadModel, { status: 'active' }>> | null>(null);
  const [contractVersion, setContractVersion] = useState<1 | 2 | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [motion, setMotion] = useState<'full' | 'reduced'>(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full');
  const offset = useRef(0);
  const latestServer = useRef(Number.NEGATIVE_INFINITY);
  const previousUnlock = useRef<boolean | null>(null);

  const applyState = (next: BunkerScreenState) => {
    const receivedAt = Date.now();
    const serverMs = Date.parse(next.serverNow);
    if (Number.isFinite(serverMs) && serverMs < latestServer.current) return false;
    if (Number.isFinite(serverMs)) latestServer.current = serverMs;
    offset.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
    setState(next);
    setNowMs(receivedAt);
    return true;
  };

  useEffect(() => {
    if (dependencies) { setBrowserDeps(null); return; }
    const next = browserDependencies(eventSlug);
    setBrowserDeps(next);
    return () => next?.audio?.dispose();
  }, [dependencies, eventSlug]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(query.matches ? 'reduced' : 'full');
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const apply = (next: any, set: (value: any) => void) => {
    if (!next) return;
    setContractVersion(next.contractVersion);
    set(next.status === 'active' || next.status === 'completed' ? { model: next, receivedAt: Date.now() } : null);
  };

  const refresh = () => {
    if (!deps) return;
    void deps.load().then(applyState).catch(() => {});
    void Promise.resolve(deps.loadMissionOne?.() ?? null).then((next) => apply(next, setOne)).catch(() => {});
    void Promise.resolve(deps.loadMissionTwo?.() ?? null).then((next) => apply(next, setTwo)).catch(() => {});
    void Promise.resolve(deps.loadMissionThree?.() ?? null).then((next) => apply(next, setThree)).catch(() => {});
    void Promise.resolve(deps.loadMissionFour?.() ?? null).then((next) => apply(next, setFour)).catch(() => {});
    void Promise.resolve(deps.loadMissionFive?.() ?? null).then((next) => apply(next, setFive)).catch(() => {});
    void Promise.resolve(deps.loadMissionSix?.() ?? null).then((next) => apply(next, setSix)).catch(() => {});
    void Promise.resolve(deps.loadUnknownPassenger?.() ?? null).then((next) => apply(next, setUnknownPassenger)).catch(() => {});
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!deps) return;
    const reload = () => refreshRef.current();
    reload();
    const unsubscribe = deps.subscribe?.(reload);
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => {
      unsubscribe?.();
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
    };
  }, [deps]);

  const remainingSeconds = state?.status === 'active' ? stateRemaining(state, nowMs, offset.current) : 0;
  const bunkerActive = state?.status === 'active';
  const phase = state?.status === 'active' ? phaseForGlobalGameState(state.globalGameState, state.phase ?? 'emergency') : null;
  const emergency = bunkerActive && phase === 'emergency';
  const storyActive = bunkerActive && state?.status === 'active' && state.globalGameState === 'UNKNOWN_PASSENGER';
  const storyModel = story(unknownPassenger, nowMs);

  useEffect(() => { setBunkerPresentationProtected(bunkerActive); return () => setBunkerPresentationProtected(false); }, [bunkerActive]);
  useEffect(() => {
    if (!bunkerActive || remainingSeconds <= 0) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [bunkerActive, remainingSeconds <= 0]);
  useEffect(() => {
    if (!deps) return;
    const interval = window.setInterval(() => refreshRef.current(), bunkerActive ? 2_000 : 1_500);
    return () => window.clearInterval(interval);
  }, [deps, bunkerActive]);
  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (!emergency || remainingSeconds <= 0 || state?.status !== 'active' || !state.soundEnabled) { audio.stopAlarm(); return; }
    audio.startAlarm(); void audio.arm(); return () => audio.stopAlarm();
  }, [deps, emergency, remainingSeconds <= 0, state?.status === 'active' ? state.soundEnabled : false]);
  useEffect(() => {
    const audio = deps?.audio;
    if (!audio) return;
    if (!bunkerActive || state?.status !== 'active' || !state.soundEnabled) { audio.stopAmbience(); return; }
    audio.startAmbience(); void audio.arm(); return () => audio.stopAmbience();
  }, [deps, bunkerActive, state?.status === 'active' ? state.soundEnabled : false]);
  useEffect(() => {
    const audio = deps?.audio;
    if (!bunkerActive || state?.status !== 'active') { previousUnlock.current = null; return; }
    const finalPhase = phase === 'final' || phase === 'completed';
    const was = previousUnlock.current;
    if (finalPhase && state.soundEnabled && was === false && state.unlocked) { audio?.playDoorUnlock(); void audio?.arm(); }
    previousUnlock.current = state.unlocked;
  }, [deps, bunkerActive, phase, state?.status === 'active' ? state.unlocked : false, state?.status === 'active' ? state.soundEnabled : false]);

  return <>
    {children}
    {bunkerActive && state?.status === 'active' && phase === 'emergency' && <BunkerEmergencyScene remainingSeconds={remainingSeconds} motionPreference={motion} />}
    {storyActive && (storyModel ? <UnknownPassengerScreen model={storyModel} /> : <section className="bunker-v2-screen bunker-v2-unknown-passenger-screen" aria-label="Неизвестный пассажир · общий экран"><p role="status">НЕИЗВЕСТНЫЙ ПАССАЖИР · ЗАГРУЖАЕМ ДОСЬЕ BK-17…</p></section>)}
    {bunkerActive && state?.status === 'active' && phase !== 'emergency' && !storyActive && <BunkerQuestScene key={state.globalGameState ?? phase} state={state} remainingSeconds={remainingSeconds} motionPreference={motion} missionOne={m1(one, nowMs)} missionTwo={m2(two, nowMs)} missionThree={m3(three, nowMs)} missionFour={m4(four, nowMs)} missionFive={m5(five, nowMs)} missionSix={m6(six, nowMs)} bunkerContractVersion={contractVersion ?? undefined} />}
  </>;
}
