// Service worker: guarda la app en el celular para que abra sin internet.
const VERSION = 'v1.0.1';
const CACHE = `viaje-europa-${VERSION}`;
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/main.js', 'js/logic.js', 'js/schema.js', 'js/store.js', 'js/sync.js', 'js/ui.js', 'js/common.js', 'js/weather.js',
  'js/screens/hoy.js', 'js/screens/plan.js', 'js/screens/listas.js', 'js/screens/gastos.js', 'js/screens/mas.js', 'js/screens/docs.js',
  'fonts/instrument-serif-latin-400-normal.woff2', 'fonts/instrument-serif-latin-ext-400-normal.woff2', 'fonts/instrument-serif-latin-400-italic.woff2',
  'fonts/hanken-grotesk-latin-500-normal.woff2', 'fonts/hanken-grotesk-latin-600-normal.woff2', 'fonts/hanken-grotesk-latin-700-normal.woff2', 'fonts/hanken-grotesk-latin-ext-600-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('viaje-europa-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('datos-iniciales.json')) return; // APIs y datos: directo a internet
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }          // rápido: lo guardado, y se actualiza por detrás
    const r = await net;
    if (r) return r;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
