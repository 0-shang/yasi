const CACHE_NAME = 'wordflow-v5-final';
const ASSETS = [
    './index.html',
    './manifest.json',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // 强制跳过等待，立即激活
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});