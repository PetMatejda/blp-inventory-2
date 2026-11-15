// BLP Inventory service worker.
//
// Goal: the app opens instantly and works on a weak or missing signal.
//  - install:   the app shell (index.html + the JS/CSS it links) is stored up front
//  - /assets/*: file names contain a content hash, so cache-first is always safe
//  - fonts:     Google Fonts are cached on first use (cache-first)
//  - pages:     network first with a short timeout, then the stored shell
//  - Firebase / Google APIs are never touched (Firestore has its own offline cache)
const CACHE_NAME = 'blp-inventory-v10-shell';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];
const NAVIGATION_TIMEOUT_MS = 3000;

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const isSkipped = (url) => !FONT_HOSTS.includes(url.hostname) && (
  url.hostname.includes('googleapis.com') || url.hostname.includes('identitytoolkit')
  || url.hostname.includes('firebase') || url.hostname.includes('google.com')
  || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')
);

// Install: store the shell and every hashed asset index.html refers to.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(SHELL);
      const html = await (await cache.match('/index.html')).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll([...new Set(assets)]);
    } catch (e) {
      // Offline during install: whatever is missing gets cached on first use.
    }
    await self.skipWaiting();
  })());
});

// Activate: drop caches of older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

const putInCache = async (request, response) => {
  if (response && (response.status === 200 || response.type === 'opaque')) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

const cacheFirst = async (request) => (await caches.match(request)) || putInCache(request, await fetch(request));

const networkFirst = async (request, { timeoutMs, fallbackUrl } = {}) => {
  const fromNetwork = fetch(request).then((response) => putInCache(request, response));
  fromNetwork.catch(() => {}); // a late failure after the timeout must not be unhandled
  try {
    if (!timeoutMs) return await fromNetwork;
    const timeout = new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), timeoutMs); });
    return await Promise.race([fromNetwork, timeout]);
  } catch (e) {
    const cached = (await caches.match(request)) || (fallbackUrl && await caches.match(fallbackUrl));
    if (cached) return cached;
    // Nothing stored yet: wait for the network after all.
    try { return await fromNetwork; } catch (err) { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http') || isSkipped(url)) return;

  if (request.mode === 'navigate') {
    // Emergency reset (…/?reset-cache=1) and similar must reach the page; the shell handles the query.
    event.respondWith(networkFirst(request, { timeoutMs: NAVIGATION_TIMEOUT_MS, fallbackUrl: '/index.html' }));
  } else if ((url.origin === self.location.origin && url.pathname.startsWith('/assets/')) || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' })));
  } else {
    event.respondWith(networkFirst(request));
  }
});
