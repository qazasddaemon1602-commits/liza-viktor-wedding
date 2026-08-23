import { useEffect, useRef, useState } from 'react';
import { siteAudio } from '../../../lib/siteAudio';
import type { BunkerOperatorMessage } from './useBunkerOperatorFeed';

type Props = {
  variant: 'projector' | 'phone';
  message: BunkerOperatorMessage | null;
  motionPreference?: 'full' | 'reduced';
  soundEnabled?: boolean;
  playSignal?: () => void;
};

const DISPLAY_MS = 8_000;
const VIEWED_PREFIX = 'bunker.operator.projector.viewed.v1:';
const HEARD_PREFIX = 'bunker.operator.signal.heard.v1:';

function storageHas(prefix: string, id: string): boolean {
  try {
    return window.sessionStorage.getItem(`${prefix}${id}`) === '1';
  } catch {
    return false;
  }
}

function storageMark(prefix: string, id: string): void {
  try {
    window.sessionStorage.setItem(`${prefix}${id}`, '1');
  } catch {
    // Replay protection is advisory when storage is unavailable.
  }
}

function localSoundEnabled(): boolean {
  return siteAudio.isEnabled() && siteAudio.getVolume() > 0;
}

function defaultSignal(): void {
  siteAudio.play('confirm');
}

function useMotionPreference(override?: 'full' | 'reduced'): 'full' | 'reduced' {
  const [motion, setMotion] = useState<'full' | 'reduced'>(() => {
    if (override) return override;
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduced'
      : 'full';
  });

  useEffect(() => {
    if (override) {
      setMotion(override);
      return undefined;
    }
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(query.matches ? 'reduced' : 'full');
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [override]);

  return motion;
}

export function BunkerOperatorTransmission({
  variant,
  message,
  motionPreference,
  soundEnabled,
  playSignal = defaultSignal,
}: Props) {
  const motion = useMotionPreference(motionPreference);
  const [visible, setVisible] = useState<BunkerOperatorMessage | null>(null);
  const pending = useRef<BunkerOperatorMessage | null>(null);
  const visibleRef = useRef<BunkerOperatorMessage | null>(null);
  visibleRef.current = visible;

  useEffect(() => {
    if (variant !== 'projector' || !message) return;
    if (message.id === visibleRef.current?.id || message.id === pending.current?.id) return;
    if (storageHas(VIEWED_PREFIX, message.id)) return;
    if (visibleRef.current) {
      pending.current = message;
    } else {
      setVisible(message);
    }
  }, [message?.id, variant]);

  useEffect(() => {
    if (variant !== 'projector' || !visible) return undefined;
    storageMark(VIEWED_PREFIX, visible.id);
    const timer = window.setTimeout(() => {
      const next = pending.current;
      pending.current = null;
      setVisible(next);
    }, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [variant, visible?.id]);

  const audibleMessage = variant === 'projector' ? visible : message;
  useEffect(() => {
    if (!audibleMessage || storageHas(HEARD_PREFIX, audibleMessage.id)) return;
    storageMark(HEARD_PREFIX, audibleMessage.id);
    if (soundEnabled ?? localSoundEnabled()) playSignal();
  }, [audibleMessage?.id, playSignal, soundEnabled]);

  if (variant === 'phone') {
    if (!message) return null;
    return (
      <aside
        className="bunker-operator-transmission bunker-operator-transmission--phone"
        role="note"
        aria-label="Последняя передача оператора BK-17"
      >
        <div className="bunker-operator-transmission__channel" aria-hidden="true">
          <span />
          <strong>BK-17</strong>
        </div>
        <div>
          <p>{message.source === 'fallback' ? 'РЕЗЕРВНЫЙ СИГНАЛ' : 'ПЕРЕДАНО ОПЕРАТОРОМ'}</p>
          <blockquote>{message.body}</blockquote>
        </div>
      </aside>
    );
  }

  if (!visible) return null;
  return (
    <section
      className="bunker-operator-transmission bunker-operator-transmission--projector"
      role="status"
      aria-label="Входящая передача оператора BK-17"
      aria-live="assertive"
      data-motion={motion}
    >
      {motion === 'full' && <div className="bunker-operator-transmission__scan" data-transmission-scan aria-hidden="true" />}
      <div className="bunker-operator-transmission__projector-frame">
        <p>ВХОДЯЩИЙ СИГНАЛ · ОПЕРАТОР BK-17</p>
        <blockquote>{visible.body}</blockquote>
        <footer>
          <span>{visible.source === 'fallback' ? 'РЕЗЕРВНЫЙ КАНАЛ' : 'ЧАСТНЫЙ КАНАЛ'}</span>
          <span>BK-17 · ПРИНЯТО</span>
        </footer>
      </div>
    </section>
  );
}
