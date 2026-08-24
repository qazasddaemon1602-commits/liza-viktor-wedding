export type AudioPriority = 'ui' | 'scene' | 'major';

export const BUNKER_NARRATION_PROFILE = Object.freeze({
  lang: 'ru-RU',
  rate: 0.92,
  pitch: 0.96,
  volume: 1,
});

export type AudioAttribution = {
  license: string;
  status: 'pending' | 'verified';
  assetSha256?: string;
  author?: string;
  sourceUrl?: string;
  downloadedAt?: string;
  originalFilename?: string;
  edits?: string;
};

export type AudioFallbackTone = {
  frequency: number;
  durationSeconds: number;
  gain: number;
  oscillatorType?: OscillatorType;
};

export type AudioCueDefinition = {
  id: string;
  src: `/audio/${string}` | null;
  sourceType: 'procedural' | 'recording';
  defaultPriority: AudioPriority;
  defaultLoop?: boolean;
  gain: number;
  maxAgeSeconds?: number;
  fallback?: AudioFallbackTone;
  attribution: AudioAttribution;
};

function localCue(
  id: string,
  defaultPriority: AudioPriority,
  options: Pick<AudioCueDefinition, 'defaultLoop' | 'gain' | 'maxAgeSeconds' | 'fallback'>,
  attributionOverrides: Pick<AudioAttribution, 'downloadedAt' | 'edits'> | undefined = undefined,
): AudioCueDefinition {
  const originalFilename = `${id.split('.').at(-1)}.wav`;
  return {
    id,
    src: `/audio/${id.replace('.', '/')}.wav`,
    sourceType: 'procedural',
    defaultPriority,
    attribution: {
      license: 'Original procedural synthesis; project-owned',
      status: 'verified',
      author: 'Liza & Viktor wedding project',
      downloadedAt: '2026-08-21',
      originalFilename,
      edits: 'Deterministic 48 kHz stereo synthesis; normalized peak; no external samples.',
      ...attributionOverrides,
    },
    ...options,
  };
}

function recordedCue(
  id: string,
  defaultPriority: AudioPriority,
  attribution: AudioAttribution,
  options: Pick<AudioCueDefinition, 'defaultLoop' | 'gain' | 'maxAgeSeconds' | 'fallback'>,
): AudioCueDefinition {
  return {
    id,
    src: `/audio/${id.replace('.', '/')}.wav`,
    sourceType: 'recording',
    defaultPriority,
    attribution,
    ...options,
  };
}

export const AUDIO_MANIFEST = {
  'ui.tap': localCue('ui.tap', 'ui', {
    gain: 0.28,
    maxAgeSeconds: 0.2,
    fallback: { frequency: 360, durationSeconds: 0.035, gain: 0.011 },
  }),
  'ui.select': localCue('ui.select', 'ui', {
    gain: 0.3,
    maxAgeSeconds: 0.3,
    fallback: { frequency: 430, durationSeconds: 0.07, gain: 0.014 },
  }),
  'ui.confirm': localCue('ui.confirm', 'ui', {
    gain: 0.34,
    maxAgeSeconds: 0.4,
    fallback: { frequency: 494, durationSeconds: 0.09, gain: 0.018, oscillatorType: 'triangle' },
  }),
  'ui.success': localCue('ui.success', 'scene', {
    gain: 0.4,
    maxAgeSeconds: 0.8,
    fallback: { frequency: 659, durationSeconds: 0.18, gain: 0.025 },
  }),
  'ui.error': localCue('ui.error', 'scene', {
    gain: 0.38,
    maxAgeSeconds: 0.8,
    fallback: { frequency: 92, durationSeconds: 0.17, gain: 0.026, oscillatorType: 'triangle' },
  }),
  'ui.reveal': localCue('ui.reveal', 'scene', {
    gain: 0.38,
    maxAgeSeconds: 0.8,
    fallback: { frequency: 440, durationSeconds: 0.16, gain: 0.018 },
  }),
  'ui.countdown': localCue('ui.countdown', 'scene', {
    gain: 0.34,
    maxAgeSeconds: 0.4,
    fallback: { frequency: 116, durationSeconds: 0.11, gain: 0.018 },
  }),
  'ui.impact': localCue('ui.impact', 'scene', {
    gain: 0.48,
    maxAgeSeconds: 1,
    fallback: { frequency: 58, durationSeconds: 0.28, gain: 0.034, oscillatorType: 'triangle' },
  }),
  'arrival.sequence': recordedCue('arrival.sequence', 'scene', {
    license: 'CC BY 3.0 Unported (individual OpenSFX samples)',
    status: 'verified',
    author: 'Metzik, patchen, eliasheuninck; OpenSFX editors',
    sourceUrl: 'https://github.com/OpenTTD/OpenSFX/blob/master/src/opensfx.psfo',
    downloadedAt: '2026-08-21',
    originalFilename: 'osfx_71.wav + osfx_10.wav + osfx_05.wav',
    assetSha256: '875ee3b93a3a17feec760f5c23950083d73d834d876347a27be6fbdf885caaa8',
    edits: '14 s cinematic edit from real train pass-by and locomotive horn recordings; resampled, timed, panned, tunnel echo, fades and limiting; no synthesized train layer.',
  }, {
    gain: 0.62,
    maxAgeSeconds: 14,
    fallback: { frequency: 174.61, durationSeconds: 1.35, gain: 0.03, oscillatorType: 'triangle' },
  }),
  'bunker.alarm': recordedCue('bunker.alarm', 'major', {
    license: 'CC0 1.0 Universal',
    status: 'verified',
    author: 'TinyWorlds',
    sourceUrl: 'https://opengameart.org/content/storm-siren',
    downloadedAt: '2026-08-21',
    originalFilename: 'storm_3_siren.ogg',
    assetSha256: '6c18d47c43521bba3db5a6e0d9a2efd7780064a3799a7e762bc572372b7220a5',
    edits: '8.4 s loop from the documented June 2013 German flood-siren field recording; 3 s source excerpt repeated, band-limited, resampled to 48 kHz stereo and peak-limited.',
  }, {
    defaultLoop: true,
    gain: 0.58,
    fallback: { frequency: 82, durationSeconds: 0.48, gain: 0.04 },
  }),
  'bunker.ambience': localCue('bunker.ambience', 'scene', {
    defaultLoop: true,
    gain: 0.34,
    fallback: { frequency: 220, durationSeconds: 0.48, gain: 0.012, oscillatorType: 'triangle' },
  }, {
    downloadedAt: '2026-08-25',
    edits: 'Original 18 s instrumental train waltz in 3/4: warm key, pad and string-like synthesis; seamless mission loop; no vocals and no external samples, recognizable melody or industrial timbre.',
  }),
  'bunker.finale': localCue('bunker.finale', 'scene', {
    gain: 0.46,
    maxAgeSeconds: 50,
    fallback: { frequency: 392, durationSeconds: 0.72, gain: 0.016, oscillatorType: 'triangle' },
  }, {
    downloadedAt: '2026-08-25',
    edits: 'Original 45 s warm instrumental finale with distinct harmony and texture, plus baked fade-in and fade-out; no vocals and no external samples or recognizable melody.',
  }),
  'bunker.door': recordedCue('bunker.door', 'major', {
    license: 'CC0 1.0 Universal',
    status: 'verified',
    author: 'rubberduck',
    sourceUrl: 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx',
    downloadedAt: '2026-08-21',
    originalFilename: 'metal_open_01.ogg',
    assetSha256: 'c0fb6c84d8c47f98755b6543974be9d2a42891b57e13c025b99f162202c3e493',
    edits: 'Layered original and pitch-lowered acoustic metal-door takes, added short tunnel reflections, 48 kHz stereo PCM, peak-limited.',
  }, {
    gain: 0.62,
    maxAgeSeconds: 6,
    fallback: { frequency: 64, durationSeconds: 0.7, gain: 0.035, oscillatorType: 'triangle' },
  }),
  'terminal.key': localCue('terminal.key', 'scene', {
    gain: 0.42,
    maxAgeSeconds: 1,
    fallback: { frequency: 220, durationSeconds: 0.06, gain: 0.012 },
  }),
  'tournament.gong': recordedCue('tournament.gong', 'major', {
    license: 'CC0 1.0 Universal',
    status: 'verified',
    author: 'rubberduck',
    sourceUrl: 'https://opengameart.org/content/100-cc0-sfx',
    downloadedAt: '2026-08-21',
    originalFilename: 'gong_01.ogg',
    assetSha256: '77b0a9acf97f77b51afa16c586097003fd1481a61245d0ce00100c99963d4730',
    edits: 'Natural recorded gong strike decoded to 48 kHz stereo PCM with a restrained hall tail and peak limiting.',
  }, {
    gain: 0.52,
    maxAgeSeconds: 4,
    fallback: { frequency: 146.83, durationSeconds: 0.6, gain: 0.02, oscillatorType: 'triangle' },
  }),
} as const satisfies Record<string, AudioCueDefinition>;

export type AudioCueId = keyof typeof AUDIO_MANIFEST;

export const audioCueIds = Object.freeze(Object.keys(AUDIO_MANIFEST) as AudioCueId[]);

export function hasLocalAudioSource(id: AudioCueId): boolean {
  return AUDIO_MANIFEST[id].src !== null;
}
