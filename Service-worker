// BuyTrip Pro - Service Worker
// Offline-first PWA

const CACHE_NAME = ‘buytrip-v1’;
const ASSETS = [
‘/’,
‘/index.html’,
‘/style.css’,
‘/app.js’,
‘/manifest.json’,
‘https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap’,
‘https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js’,
];

// Install: cache all assets
self.addEventListener(‘install’, e => {
e.waitUntil(
caches.open(CACHE_NAME).then(cache => {
return Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})));
}).then(() => self.skipWaiting())
);
});

// Activate: clean old caches
self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
).then(() => self.clients.claim())
);
});

// Fetch: network first, fallback to cache
self.addEventListener(‘fetch’, e => {
// Don’t intercept Anthropic API or Supabase calls
if (e.request.url.includes(‘anthropic.com’) ||
e.request.url.includes(‘supabase.co’) ||
e.request.method !== ‘GET’) {
return;
}

e.respondWith(
fetch(e.request)
.then(response => {
// Cache successful responses
if (response.ok) {
const clone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
}
return response;
})
.catch(() => caches.match(e.request))
);
});
