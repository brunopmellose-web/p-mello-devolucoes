
const CACHE_NAME = 'pmello-devolucoes-v1';

const ARQUIVOS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARQUIVOS);
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes
          .filter((nome) => nome.startsWith('pmello-devolucoes-') && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', copia);
          });
          return response;
        })
        .catch(async () => {
          return (
            await caches.match('/index.html')
          ) || Response.error();
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((armazenado) => {
      if (armazenado) return armazenado;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copia);
          });
        }

        return response;
      });
    })
  );
});
