const CACHE_NAME = 'jl-chess-v12-cache';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // Librerías externas (para que funcionen offline)
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js',
  'https://cdn.socket.io/4.7.2/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  // Sonidos
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3',
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.mp3',
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.mp3',
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/GenericNotify.mp3'
];

// 1. INSTALACIÓN: Guardamos los recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos en caché');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. ACTIVACIÓN: Limpiamos cachés viejas si actualizas la versión
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. INTERCEPTAR PETICIONES (FETCH): Estrategia "Cache First, luego Network"
self.addEventListener('fetch', event => {
  // Ignoramos peticiones que no sean GET o que sean de socket.io (para no afectar el modo online)
  if (event.request.method !== 'GET' || event.request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, lo devolvemos
        if (response) {
          return response;
        }
        // Si no, lo pedimos a internet y lo guardamos dinámicamente (ej. imágenes de piezas)
        return fetch(event.request).then(
          function(response) {
            if(!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
              return response;
            }
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});

self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: 'logo.png',
            badge: 'logo.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200]
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
