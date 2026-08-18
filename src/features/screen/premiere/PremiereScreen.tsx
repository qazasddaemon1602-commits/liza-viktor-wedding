import { useEffect, useRef } from 'react';
import { getCountdownFrame } from '../../premiere/countdown';
import { PremiereCountdown } from '../../premiere/PremiereCountdown';
import { PremierePlayer } from '../../premiere/PremierePlayer';
import type { PremiereScreenState } from '../../premiere/premiere.service';
import { PremiereStandbyScreen } from './PremiereStandbyScreen';

type PremiereScreenProps = {
  state: PremiereScreenState;
  nowMs: number;
  onCountdownTick?: (second: number) => void;
  onEnded?: () => void;
};

export function PremiereScreen({ state, nowMs, onCountdownTick, onEnded }: PremiereScreenProps) {
  const lastCueRef = useRef<number | null>(null);

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
        onEnded={onEnded}
      />

      {showStandby && <PremiereStandbyScreen />}
      {showCountdown && <PremiereCountdown number={countdownNumber} />}
      {state.status === 'paused' && (
        <div className="premiere-paused-indicator" aria-label="Премьера на паузе">
          ПАУЗА
        </div>
      )}
    </section>
  );
}
