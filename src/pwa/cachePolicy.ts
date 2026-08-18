const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
const STATIC_EXTENSIONS = [
  '.js',
  '.mjs',
  '.css',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.ico',
];

export const APP_SHELL_PATHS: readonly string[] = [
  '/',
  '/manifest.webmanifest',
];

function pathnameOf(value: string): string {
  try {
    return new URL(value, 'https://wedding.local').pathname.toLowerCase();
  } catch {
    return value.split(/[?#]/, 1)[0]!.toLowerCase();
  }
}

export function shouldBypassServiceWorkerCache(url: string): boolean {
  const pathname = pathnameOf(url);
  return VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

export function isRuntimeCacheableAsset(url: string): boolean {
  if (shouldBypassServiceWorkerCache(url)) return false;

  let parsed: URL;
  try {
    parsed = new URL(url, 'https://wedding.local');
  } catch {
    return false;
  }

  if (parsed.origin !== 'https://wedding.local') return false;

  const pathname = parsed.pathname.toLowerCase();
  if (pathname.startsWith('/rest/') || pathname.startsWith('/functions/')) return false;

  return STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}
