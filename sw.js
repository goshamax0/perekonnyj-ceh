/* Перегонный цех — service worker v33.
   Кэшируются только собственные статические файлы. Запросы к Supabase и CDN
   не перехватываются: ответы с авторизацией не должны попадать в кэш. */
const VERSION = 'v33';
const CACHE_NAME = `perekonnyj-tseh-${VERSION}`;
const INDEX_URL = new URL('./index.html', self.location.href).href;
const APP_STATIC_RESOURCES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  // Новая версия активируется сразу: старые сборки не показывают баннер обновления
  // и иначе могли бы остаться на закэшированной странице навсегда.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_STATIC_RESOURCES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('perekonnyj-tseh-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(INDEX_URL).then(cached => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
