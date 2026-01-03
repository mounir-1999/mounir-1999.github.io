// Service Worker for Offline Support
const CACHE_NAME = 'scout-quiz-v1';

// Get the base path (directory where sw.js is located)
const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/'));

// Helper function to normalize paths
const normalizePath = (path) => {
    if (path.startsWith('/')) {
        return basePath + path;
    }
    return basePath + '/' + path;
};

const ASSETS_TO_CACHE = [
    normalizePath('/'),
    normalizePath('/index.html'),
    normalizePath('/mcq.html'),
    normalizePath('/random.html'),
    normalizePath('/styles.css'),
    normalizePath('/mcq.css'),
    normalizePath('/script.js'),
    normalizePath('/mcq.js'),
    normalizePath('/mcq-data.js'),
    normalizePath('/set1.js'),
    normalizePath('/set2.js'),
    normalizePath('/set3.js'),
    normalizePath('/set4.js'),
    normalizePath('/tik.mp3'),
    normalizePath('/icon-512x512.png'),
    normalizePath('/manifest.json')
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.log('Cache addAll failed:', err);
                // Cache files individually if addAll fails
                return Promise.all(
                    ASSETS_TO_CACHE.map((url) => {
                        return cache.add(url).catch((err) => {
                            console.log(`Failed to cache ${url}:`, err);
                        });
                    })
                );
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached version or fetch from network
            return response || fetch(event.request).then((fetchResponse) => {
                // Cache new requests for future use
                if (fetchResponse && fetchResponse.status === 200) {
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            }).catch(() => {
                // If offline and not in cache, return a fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match(normalizePath('/index.html')) || caches.match(normalizePath('/'));
                }
            });
        })
    );
});
