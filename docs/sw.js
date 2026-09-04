/**
 * Trip Budget Planner — Service Worker
 * Network-first for app code (instant updates), cache-first for CDN assets.
 */

const CACHE_NAME = 'trip-budget-20260725211224';

// App-shell files — use NETWORK-FIRST so code updates appear immediately
const NETWORK_FIRST = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json'];

// CDN assets — cache-first (they never change)
const CDN_HOSTS = ['jsdelivr.net', 'googleapis.com', 'gstatic.com'];

// ── Install: pre-cache a minimal shell (network-first files fetched fresh) ──
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

// ── Activate: wipe ALL old caches so stale app.js is gone ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls
  if (url.pathname.startsWith('/api/')) return;

  // App-shell: NETWORK-FIRST → always try network, fall back to cache offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a fresh copy for offline use
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') return caches.match('index.html');
          })
        )
    );
    return;
  }

  // CDN assets: cache-first (fonts, Chart.js, Flatpickr — never change)
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        }).catch(() => null);
      })
    );
  }
});
