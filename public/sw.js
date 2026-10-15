const CACHE_NAME = 'hush-v1';
const PRECACHE_URLS = ['/', '/members', '/discover', '/messages', '/offline'];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    // Network-only for auth and API (never serve stale auth)
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for pages, cache-first for static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok && request.method === 'GET') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached || caches.match('/offline'));
      return cached || fetchPromise;
    })
  );
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
