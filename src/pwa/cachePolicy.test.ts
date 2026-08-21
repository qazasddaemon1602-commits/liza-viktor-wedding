import { describe, expect, it } from 'vitest';
import {
  APP_SHELL_PATHS,
  isRuntimeCacheableAsset,
  shouldBypassServiceWorkerCache,
} from './cachePolicy';

describe('PWA cache policy', () => {
  it('pre-caches only the lightweight app shell entry points', () => {
    expect(APP_SHELL_PATHS).toContain('/');
    expect(APP_SHELL_PATHS).toContain('/manifest.webmanifest');
    expect(APP_SHELL_PATHS.some((path) => path.toLowerCase().endsWith('.mp4'))).toBe(false);
  });

  it('never service-worker caches the 263MB premiere source or other video formats', () => {
    expect(shouldBypassServiceWorkerCache('/media/КОЛЬЦО.mp4')).toBe(true);
    expect(shouldBypassServiceWorkerCache('https://cdn.example/ring.mp4?version=2')).toBe(true);
    expect(shouldBypassServiceWorkerCache('/media/ring.webm')).toBe(true);
    expect(shouldBypassServiceWorkerCache('/media/ring.mov')).toBe(true);
  });

  it('allows hashed app assets, local fonts and small imagery into runtime cache', () => {
    expect(isRuntimeCacheableAsset('/assets/index-abc123.js')).toBe(true);
    expect(isRuntimeCacheableAsset('/assets/index-def456.css')).toBe(true);
    expect(isRuntimeCacheableAsset('/fonts/wedding.woff2')).toBe(true);
    expect(isRuntimeCacheableAsset('/icons/icon-192.png')).toBe(true);
    expect(isRuntimeCacheableAsset('/images/train.webp')).toBe(true);
  });

  it('does not treat Supabase/API/data calls as static runtime assets', () => {
    expect(isRuntimeCacheableAsset('/rest/v1/event_state?select=*')).toBe(false);
    expect(isRuntimeCacheableAsset('/functions/v1/register')).toBe(false);
    expect(isRuntimeCacheableAsset('https://project.supabase.co/rest/v1/events')).toBe(false);
  });
});
