const SHELL_CACHE = 'wedding-shell-v1';
const RUNTIME_CACHE = 'wedding-runtime-v1';
const APP_SHELL = ['/', '/manifest.webmanifest'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
const STATIC_EXTENSIONS = [
  '.js', '.mjs', '.css', '.woff', '.woff2', '.ttf', '.otf',
  '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico',
];

function pathnameOf(url) {
  try {
    return new URL(url, self.location.origin).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function isVideoRequest(request) {
  const pathname = pathnameOf(request.url);
  return VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function isRuntimeAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  const pathname = url.pathname.toLowerCase();
  return STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('wedding-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (isVideoRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(request))
            ?? (await caches.match('/'))
            ?? Response.error();
        }),
    );
    return;
  }

  if (!isRuntimeAsset(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          void caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached ?? network;
    }),
  );
});
