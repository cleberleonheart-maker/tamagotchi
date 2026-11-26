const CACHE_NAME = 'tamavida-v42';
const CACHE_PREFIX = 'tamavida-';
const CACHE_VERSION = CACHE_NAME.slice(CACHE_PREFIX.length).replace('v', '');
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=42',
  './js/data.js?v=42',
  './js/audio.js?v=42',
  './js/engine.js?v=42',
  './js/games.js?v=42',
  './js/ui.js?v=42',
  './js/app.js?v=42',
  './manifest.json?v=42',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./?action=feed');
      return null;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put('./index.html', copy))
            .then(() => response)
            .catch(() => response);
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && url.searchParams.get('v') === CACHE_VERSION) return cached;
      const fresh = fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        return caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .then(() => response)
          .catch(() => response);
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
