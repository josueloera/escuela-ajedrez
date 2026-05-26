const CACHE_NAME = 'jl-chess-v5.8';

const ASSETS = [
  './',
  './index.html',
  './logo.jpg',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js',
  'https://cdn.socket.io/4.7.2/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); }))
    ).then(() => {
      // Notifica a todos los clientes que hay nueva versión
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME }));
      });
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Para index.html siempre intenta red primero (para detectar cambios)
  if (e.request.url.endsWith('/') || e.request.url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});