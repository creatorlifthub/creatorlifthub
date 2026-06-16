// ==========================================================
// CreatorLift Hub — Service Worker
// Basic offline support via cache-first strategy for app shell
// ==========================================================

const CACHE_NAME = 'creatorlift-hub-v1';

// Core files needed for the app shell to load offline
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

// ---------- INSTALL ----------
// Pre-cache the app shell so the site can open offline after first visit
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE ----------
// Clean up old cache versions when a new service worker takes over
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
// Strategy:
//  - Same-origin requests (the app shell itself): cache-first, falling back to network,
//    so the site still opens with no internet connection.
//  - Cross-origin requests (fonts, WhatsApp links, etc.): network-first, falling back to
//    cache if available, so external/live content stays fresh whenever online.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests — POSTs (e.g. any future form posts) pass straight through
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Cache-first for the app shell
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((networkRes) => {
            // Cache a copy of newly-fetched same-origin assets for next offline use
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return networkRes;
          })
          .catch(() => caches.match('./index.html')); // offline fallback
      })
    );
  } else {
    // Network-first for external resources (Google Fonts, WhatsApp, etc.)
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
  }
});
