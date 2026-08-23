const CACHE_NAME = 'blp-inventory-v7-final';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];



// Install Event - Force activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event - Purge all old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});


// Fetch Event - Network First for latest updates, falling back to cache when offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip Firebase/Google APIs from service worker cache
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('identitytoolkit') || url.origin.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

