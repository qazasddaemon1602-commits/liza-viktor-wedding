import { useEffect, useRef, useState } from 'react';
import { getCountdownFrame } from '../../premiere/countdown';
import { PremiereCountdown } from '../../premiere/PremiereCountdown';
import { PremierePlayer } from '../../premiere/PremierePlayer';
import type { PremiereScreenState } from '../../premiere/premiere.service';
import { PremiereStandbyScreen } from './PremiereStandbyScreen';

type PremiereScreenProps = {
  state: PremiereScreenState;
  nowMs: number;
  muted?: boolean;
  onCountdownTick?: (second: number) => void;
  onVideoReady?: () => void;
  onEnded?: () => void;
};

export function PremiereScreen({
  state,
  nowMs,
  muted = false,
  onCountdownTick,
  onVideoReady,
  onEnded,
}: PremiereScreenProps) {
  const lastCueRef = useRef<number | null>(null);
  const [endedLocally, setEndedLocally] = useState(false);

  const configured =
    state.status === 'standby'
    || state.status === 'countdown'
    || state.status === 'playing'
    || state.status === 'paused';

  let countdownNumber: 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | null = null;
  let shouldPlay = state.status === 'playing';

  if (state.status === 'countdown' && state.startAt) {
    const frame = getCountdownFrame(nowMs, Date.parse(state.startAt));
    countdownNumber = frame.number;
    shouldPlay = frame.shouldPlay;
  }

  useEffect(() => {
    if (
      state.status !== 'countdown'
      || !state.countdownSoundEnabled
      || countdownNumber === null
      || !onCountdownTick
    ) {
      if (state.status !== 'countdown') lastCueRef.current = null;
      return;
    }

    if (lastCueRef.current === countdownNumber) return;
    lastCueRef.current = countdownNumber;
    onCountdownTick(countdownNumber);
  }, [countdownNumber, onCountdownTick, state]);

  useEffect(() => {
    if (state.status === 'standby' || state.status === 'countdown') {
      setEndedLocally(false);
      return;
    }

    if (
      (state.status === 'playing' || state.status === 'paused')
      && state.positionSeconds < state.durationSeconds - 0.5
    ) {
      setEndedLocally(false);
    }
  }, [state]);

  const handleEnded = () => {
    setEndedLocally(true);
    onEnded?.();
  };

  if (state.status === 'black') {
    return <section className="premiere-black" data-testid="premiere-black" aria-label="Чёрный экран" />;
  }

  if (!configured) return null;

  const showStandby = state.status === 'standby';
  const showCountdown = state.status === 'countdown' && countdownNumber !== null;
  const showPlayer = shouldPlay || state.status === 'playing' || state.status === 'paused';

  return (
    <section
      className={`premiere-screen${showPlayer ? ' premiere-screen-player-visible' : ''}`}
      data-premiere-status={state.status}
    >
      <PremierePlayer
        src={state.mediaUrl}
        shouldPlay={shouldPlay || state.status === 'playing'}
        positionSeconds={state.positionSeconds}
        muted={muted}
        onReady={onVideoReady}
        onEnded={handleEnded}
      />

      {showStandby && <PremiereStandbyScreen />}
      {showCountdown && <PremiereCountdown number={countdownNumber} />}
      {state.status === 'paused' && (
        <div className="premiere-paused-indicator" aria-label="Премьера на паузе">
          ПАУЗА
        </div>
      )}
      {endedLocally && (
        <div
          className="premiere-ended-black"
          data-testid="premiere-ended-black"
          aria-label="Премьера завершена"
        />
      )}
    </section>
  );
}

