const CACHE_NAME = 'jl-chess-v17-local-cache';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './vendor/chessboard-1.0.0.min.css',
  './vendor/jquery.min.js',
  './vendor/chess.js',
  './vendor/chessboard-1.0.0.min.js',
  './vendor/socket.io.min.js',
  './vendor/sweetalert2.all.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './js/client.js',
  './css/style.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames
        .filter(cacheName => cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      return fetch(event.request).then(networkResponse => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'logo.png',
    badge: 'logo.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        const focused = clientList.find(client => client.focused) || clientList[0];
        return focused.focus();
      }
      return clients.openWindow('/');
    })
  );
});
