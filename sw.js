const CACHE_NAME = 'ielts-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  'https://unpkg.com/vue@3/dist/vue.global.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});