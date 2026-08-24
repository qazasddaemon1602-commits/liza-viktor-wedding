import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { CapsuleShowcaseOverlay } from './CapsuleShowcaseOverlay';
import { EveningNominationsOverlay } from './EveningNominationsOverlay';
import {
  subscribeToEveningNominations,
  type EveningNominationsScreenEvent,
} from './eveningNominations.service';
import {
  subscribeToCapsuleShowcase,
  type CapsuleShowcaseScreenEvent,
} from './messageCapsule.service';
import { TrainRadioOverlay } from './TrainRadioOverlay';
import { TRAIN_SOUND_AUDIO_SOURCE } from './trainRadioAudio';
import {
  subscribeToTrainRadio,
  type RadioTransmissionScreenEvent,
} from './trainRadio.service';
import {
  subscribeToTrainSound,
  type TrainSoundScreenEvent,
} from './trainSound.service';
import { WeddingLiveAudioPlayer } from './WeddingLiveAudioPlayer';
import {
  reactionEmoji,
  subscribeToGuestReactions,
  type GuestReactionKey,
  type GuestReactionScreenEvent,
  type WeddingLiveRealtimeClient,
} from './weddingLive.service';

type ReactionBurst = {
  reaction: GuestReactionKey;
  count: number;
  expiresAt: number;
  lastEventId: string;
};

type Props = {
  eventSlug?: string;
  children: ReactNode;
  subscribe?: (callback: (event: GuestReactionScreenEvent) => void) => () => void;
  subscribeCapsule?: (callback: (event: CapsuleShowcaseScreenEvent) => void) => () => void;
  subscribeRadio?: (callback: (event: RadioTransmissionScreenEvent) => void) => () => void;
  subscribeTrainSound?: (callback: (event: TrainSoundScreenEvent) => void) => () => void;
  subscribeNominations?: (callback: (event: EveningNominationsScreenEvent) => void) => () => void;
  ttlMs?: number;
};

function browserReactionSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: GuestReactionScreenEvent) => void) => subscribeToGuestReactions(client, eventSlug, callback);
}
function browserCapsuleSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: CapsuleShowcaseScreenEvent) => void) => subscribeToCapsuleShowcase(client, eventSlug, callback);
}
function browserRadioSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: RadioTransmissionScreenEvent) => void) => subscribeToTrainRadio(client, eventSlug, callback);
}
function browserTrainSoundSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: TrainSoundScreenEvent) => void) => subscribeToTrainSound(client, eventSlug, callback);
}
function browserNominationsSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: EveningNominationsScreenEvent) => void) => subscribeToEveningNominations(client, eventSlug, callback);
}

const noCapsuleSubscribe = () => () => undefined;
const noRadioSubscribe = () => () => undefined;
const noTrainSoundSubscribe = () => () => undefined;
const noNominationsSubscribe = () => () => undefined;

export function WeddingLiveProjectorLayer({
  eventSlug = 'liza-viktor',
  children,
  subscribe,
  subscribeCapsule,
  subscribeRadio,
  subscribeTrainSound,
  subscribeNominations,
  ttlMs = 2800,
}: Props) {
  const resolvedSubscribe = useMemo(() => subscribe ?? browserReactionSubscribe(eventSlug), [eventSlug, subscribe]);
  const resolvedCapsuleSubscribe = useMemo(
    () => subscribeCapsule ?? (subscribe ? noCapsuleSubscribe : browserCapsuleSubscribe(eventSlug)),
    [eventSlug, subscribe, subscribeCapsule],
  );
  const resolvedRadioSubscribe = useMemo(
    () => subscribeRadio ?? (subscribe ? noRadioSubscribe : browserRadioSubscribe(eventSlug)),
    [eventSlug, subscribe, subscribeRadio],
  );
  const resolvedTrainSoundSubscribe = useMemo(
    () => subscribeTrainSound ?? (subscribe ? noTrainSoundSubscribe : browserTrainSoundSubscribe(eventSlug)),
    [eventSlug, subscribe, subscribeTrainSound],
  );
  const resolvedNominationsSubscribe = useMemo(
    () => subscribeNominations ?? (subscribe ? noNominationsSubscribe : browserNominationsSubscribe(eventSlug)),
    [eventSlug, subscribe, subscribeNominations],
  );
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [capsule, setCapsule] = useState<CapsuleShowcaseScreenEvent | null>(null);
  const [radio, setRadio] = useState<RadioTransmissionScreenEvent | null>(null);
  const [trainSound, setTrainSound] = useState<TrainSoundScreenEvent | null>(null);
  const [nominations, setNominations] = useState<EveningNominationsScreenEvent | null>(null);

  useEffect(() => resolvedSubscribe((event) => {
    const now = Date.now();
    setBursts((current) => {
      const active = current.filter((burst) => burst.expiresAt > now);
      const existing = active.find((burst) => burst.reaction === event.reaction);
      if (existing) {
        return active.map((burst) => burst.reaction === event.reaction
          ? { ...burst, count: Math.min(99, burst.count + 1), expiresAt: now + ttlMs, lastEventId: event.id }
          : burst);
      }
      return [...active, { reaction: event.reaction, count: 1, expiresAt: now + ttlMs, lastEventId: event.id }].slice(-5);
    });
  }), [resolvedSubscribe, ttlMs]);
  useEffect(() => resolvedCapsuleSubscribe((event) => setCapsule(event)), [resolvedCapsuleSubscribe]);
  useEffect(() => resolvedRadioSubscribe((event) => setRadio(event)), [resolvedRadioSubscribe]);
  useEffect(() => resolvedTrainSoundSubscribe((event) => setTrainSound(event)), [resolvedTrainSoundSubscribe]);
  useEffect(() => resolvedNominationsSubscribe((event) => setNominations(event)), [resolvedNominationsSubscribe]);

  useEffect(() => {
    if (!bursts.length) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setBursts((current) => current.filter((burst) => burst.expiresAt > now));
    }, 250);
    return () => window.clearInterval(interval);
  }, [bursts.length]);

  useEffect(() => {
    if (!capsule) return;
    const duration = Math.min(58_000, capsule.messages.length * 5_500 + 900);
    const timer = window.setTimeout(() => setCapsule((current) => current?.id === capsule.id ? null : current), duration);
    return () => window.clearTimeout(timer);
  }, [capsule]);
  useEffect(() => {
    if (!radio) return;
    const timer = window.setTimeout(() => setRadio((current) => current?.id === radio.id ? null : current), 60_000);
    return () => window.clearTimeout(timer);
  }, [radio]);
  useEffect(() => {
    if (!trainSound) return;
    const timer = window.setTimeout(
      () => setTrainSound((current) => current?.id === trainSound.id ? null : current),
      240_000,
    );
    return () => window.clearTimeout(timer);
  }, [trainSound]);
  useEffect(() => {
    if (!nominations) return;
    const duration = Math.min(43_000, nominations.nominations.length * 5_800 + 1_000);
    const timer = window.setTimeout(
      () => setNominations((current) => current?.id === nominations.id ? null : current),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [nominations]);

  return (
    <>
      {children}
      {capsule && <CapsuleShowcaseOverlay messages={capsule.messages} />}
      {nominations && <EveningNominationsOverlay nominations={nominations.nominations} />}
      {radio && (
        <TrainRadioOverlay
          transmission={radio}
          onAudioEnded={() => setRadio((current) => current?.id === radio.id ? null : current)}
        />
      )}
      {trainSound && (
        <WeddingLiveAudioPlayer
          src={TRAIN_SOUND_AUDIO_SOURCE}
          eventKey={trainSound.id}
          onEnded={() => setTrainSound((current) => current?.id === trainSound.id ? null : current)}
        />
      )}
      <aside className="wedding-live-projector-layer" aria-live="polite" aria-label="Реакции гостей">
        {bursts.map((burst) => (
          <div key={`${burst.reaction}:${burst.lastEventId}`} className="wedding-live-reaction-burst">
            <span aria-hidden="true">{reactionEmoji(burst.reaction)}</span>
            {burst.count > 1 && <strong>×{burst.count}</strong>}
          </div>
        ))}
      </aside>
    </>
  );
}
