const CACHE_VERSION = 'kaih-v3.1';
const RUNTIME_CACHE = 'kaih-runtime-v3.1';
const APP_SHELL = [
  './','./index.html','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
const CDN_HOSTS = ['cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com'];
const FONT_HOSTS = ['fonts.googleapis.com','fonts.gstatic.com'];
const API_HOSTS = ['script.google.com','googleusercontent.com','script.googleusercontent.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== RUNTIME_CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (API_HOSTS.some(h => url.hostname.includes(h))) return;
  if (FONT_HOSTS.some(h => url.hostname.includes(h))) { e.respondWith(swr(req, RUNTIME_CACHE)); return; }
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) { e.respondWith(cacheFirst(req, RUNTIME_CACHE)); return; }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res && res.status === 200) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(cacheFirst(req, CACHE_VERSION));
});
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type !== 'opaque') {
      const c = await caches.open(cacheName);
      c.put(req, res.clone());
    }
    return res;
  } catch { return cached || new Response('', { status: 503 }); }
}
async function swr(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchP = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchP;
}
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
