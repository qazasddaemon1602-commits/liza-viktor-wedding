export type PremiereCountdownNumber = 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1;

export type PremiereCountdownFrame = {
  number: PremiereCountdownNumber | null;
  shouldPlay: boolean;
};

export function getCountdownFrame(nowMs: number, startMs: number): PremiereCountdownFrame {
  if (!Number.isFinite(nowMs) || !Number.isFinite(startMs)) {
    throw new Error('Countdown timestamps must be finite');
  }

  const remainingMs = startMs - nowMs;
  if (remainingMs <= 0) {
    return { number: null, shouldPlay: true };
  }

  const seconds = Math.ceil(remainingMs / 1000);
  const number = Math.min(10, Math.max(1, seconds)) as PremiereCountdownNumber;
  return { number, shouldPlay: false };
}
