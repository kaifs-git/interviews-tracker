const CACHE = 'interviews-tracker-v10';
const STATIC_ASSETS = [
  '/',
  '/static/app.css',
  '/static/js/api.js',
  '/static/js/auth.js',
  '/static/js/components.js',
  '/static/js/dashboard.js',
  '/static/js/companies.js',
  '/static/js/applications.js',
  '/static/js/interviews.js',
  '/static/js/contacts.js',
  '/static/js/admin.js',
  '/static/js/settings.js',
  '/static/js/agent.js',
  '/static/js/router.js',
  '/static/js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses any other SW cache, always fetches fresh from network
      .then(c => Promise.all(STATIC_ASSETS.map(url => fetch(new Request(url, { cache: 'reload' })).then(res => c.put(url, res)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
      ))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-first for API/auth calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'InterviewsTracker', body: 'New activity from your agent', url: '/' };
  try {
    if (e.data) data = { ...data, ...JSON.parse(e.data.text()) };
  } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon/192',
      badge: '/icon/72',
      tag: 'agent-activity',
      renotify: true,
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
