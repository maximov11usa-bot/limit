/* Офлайн: всё приложение кэшируется при первом открытии. Поменяй VERSION при обновлении файлов. */
const VERSION = 'limit-beta-2';
const FILES = ['./','./index.html','./styles.css','./app.js','./history.js','./manifest.webmanifest',
  './fonts/barlow-condensed-latin.woff2','./fonts/roboto-condensed-cyrillic.woff',
  './icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});
