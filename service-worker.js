/* Penguin Invaders — Service Worker for Offline Caching */
const CACHE_NAME = 'pi-cache-v1';

const STATIC_ASSETS = [
  './',
  './index.html'
];

// ─── Install: precache the app shell & static assets ─────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting for all clients to close
  self.skipWaiting();
});

// ─── Activate: clean up stale caches ──────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ─── Fetch: Cache First for static, Network First for dynamic ─
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // ── Cache First (static assets) ──
  // Matches requests with a static file extension
  if (/\.(html?|css|js|json|png|jpg|jpeg|gif|svg|ico|webp|mp3|wav|ogg|woff2?|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Serve from cache, update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse);
              }
            }).catch(() => { /* offline — cached copy is enough */ });
            return cachedResponse;
          }
          // Not in cache — fetch from network and cache
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // If fetch fails and not in cache, try the offline fallback
            return caches.match('./index.html');
          });
        });
      })
    );
    return;
  }

  // ── Network First (dynamic content / navigation) ──
  event.respondWith(
    fetch(request).then((networkResponse) => {
      // Cache successful responses for offline fallback
      if (networkResponse && networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return networkResponse;
    }).catch(() => {
      // Offline — fall back to cache
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        // Last resort: serve the app shell so the game still loads
        return caches.match('./index.html');
      });
    })
  );
});
