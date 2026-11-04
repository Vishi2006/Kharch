const CACHE_NAME = 'kharch-static-v2';
const DYNAMIC_CACHE_NAME = 'kharch-dynamic-v2';

// Static assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico',
];

// Install service worker and precache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline page shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch hijacking and caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (mutations, login, etc.) - Network Only
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore Chrome Extensions, hot-reloading (webpack), etc.
  if (url.pathname.includes('/_next/webpack-hmr') || !url.protocol.startsWith('http')) {
    return;
  }

  // 3. API Cache fallback strategy (Dashboard / History / Summaries)
  const isDashboardApi = url.pathname.includes('/api/transactions/dashboard');
  const isHistoryApi = url.pathname.includes('/api/transactions'); // matches history lists too
  const isSummariesApi = url.pathname.includes('/api/summaries');
  const isApiRequest = url.pathname.includes('/api/');

  // Force generic API endpoints (auth, spaces list creation, etc.) to load from network only
  if (isApiRequest && !isDashboardApi && !isHistoryApi && !isSummariesApi) {
    event.respondWith(fetch(request));
    return;
  }

  if (isDashboardApi || isHistoryApi || isSummariesApi) {
    // Network First with Cache Fallback for sensitive financial reads
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, clone and cache it dynamically
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Network failed, looking for cached API data:', url.pathname);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a structured offline error JSON if cache is empty
            return new Response(
              JSON.stringify({
                offline: true,
                message: 'You are offline. Cached records are unavailable for this query.',
                transactions: [],
                trends: [],
                importance: [],
                topSpendingTitles: [],
                repeatedWasteful: []
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, fonts, SVG) - Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => {
          // Silent catch for background fetch offline errors
        });
        return cachedResponse;
      }

      // Fallback to network
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
