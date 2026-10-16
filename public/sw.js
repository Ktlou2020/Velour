/* Unbound service worker.
 *
 * Caching rules (privacy first — this is an adult dating site):
 *  - /_next/static/** (content-hashed, immutable) and app icons/screenshots: cache-first.
 *  - Page navigations: network-only (member pages are personal and are never
 *    stored); when the network fails, the precached /offline page is shown.
 *  - /api/** (incl. /api/media, which is private and watermarked per viewer),
 *    /_next/image, /_next/data, RSC fetches, media, non-GET and cross-origin
 *    requests: not handled here at all — they always go straight to the network.
 *  - Bump VERSION to drop every old cache on activate.
 */
const VERSION = 'v2';
const STATIC_CACHE = `unbound-static-${VERSION}`;
const OFFLINE_CACHE = `unbound-offline-${VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, OFFLINE_CACHE];
const OFFLINE_URL = '/offline';
const STATIC_MAX_ENTRIES = 300;

const STATIC_FILES = new Set([
  '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png', '/apple-touch-icon.png',
  '/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png',
]);

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/screenshots/') ||
    STATIC_FILES.has(url.pathname)
  );
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'same-origin' })))
      .catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drops old versions, including the legacy 'hush-v1' cache that stored member pages.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch { /* unsupported */ }
    }
    await self.clients.claim();
  })());
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    event.waitUntil(cache.put(request, response.clone()).then(() => trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES)).catch(() => {}));
  }
  return response;
}

async function networkWithOfflineFallback(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    return offline || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never touch API traffic — /api/media is private and watermarked per viewer.
  if (url.pathname.startsWith('/api/')) return;
  // Range requests (video/audio) and media elements always go to the network.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkWithOfflineFallback(event));
    return;
  }

  if (isCacheableStatic(url)) {
    event.respondWith(cacheFirst(event));
  }
  // Everything else (RSC payloads, /_next/image, /_next/data, user uploads) is network-only.
});

// ── Push Notifications ───────────────────────────────────────────────────────
// Payload (lib/push.ts): { title, body, url, tag, icon, badge }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Unbound';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'hush-notification',
    // Same tag (e.g. one chat) replaces the old alert — still buzz for the new one
    renotify: !!data.tag,
    data: { url: safeUrl(data.url) },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    // Open tabs refresh their badges straight away
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: 'hush:push', tag: options.tag })))
      .catch(() => {}),
  ]));
});

/** Only same-origin paths; anything else opens /notifications. */
function safeUrl(raw) {
  try {
    if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/notifications';
    const u = new URL(raw, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : '/notifications';
  } catch {
    return '/notifications';
  }
}

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(safeUrl(event.notification.data && event.notification.data.url), self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prefer a tab already on the target, then any Unbound tab (focus + navigate)
    const exact = windowClients.find((c) => c.url === target);
    if (exact && 'focus' in exact) return exact.focus();
    for (const client of windowClients) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        const focused = 'focus' in client ? await client.focus() : client;
        if ('navigate' in focused) return await focused.navigate(target);
        return focused;
      } catch {
        // navigate() can fail for an uncontrolled client — open a new window instead
        break;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

// ── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    // Placeholder for background sync if needed
  }
});
