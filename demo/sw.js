// sw.js — eodb service worker: cache-first with network fallback, so the surface (and the modules/priors it
// pulls in) keep working offline once used. Same-origin GET only; everything else passes through untouched.
const CACHE = 'eodb-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    const network = fetch(e.request).then((res) => {
      if (res && (res.status === 200 || res.type === 'opaque')) cache.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
