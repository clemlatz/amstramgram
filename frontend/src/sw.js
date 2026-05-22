import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA shell: always fetch /index.html, cached for offline use
registerRoute(
  new NavigationRoute(
    ({ event }) =>
      new NetworkFirst({ cacheName: 'spa-shell', networkTimeoutSeconds: 3 }).handle({
        event,
        request: new Request('/index.html'),
      }),
    { denylist: [/^\/api\//] }
  )
);

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/media/')) {
    console.log('[SW] fetch intercepted for media:', event.request.url);
  }
});

registerRoute(
  /\/api\/media\//,
  new CacheFirst({
    cacheName: 'media-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200, 206] }),
    ],
  }),
  'GET'
);
