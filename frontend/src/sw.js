import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Explicitly bypass the SW for all API requests — prevents Safari from intercepting
// API fetches. registerRoute regexes are tested against the full URL, so match
// on pathname instead.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// Fetch the actual navigation URL — the server returns index.html for all SPA routes,
// so there's no URL mismatch and Safari respondWith works correctly.
registerRoute(
  new NavigationRoute(new NetworkFirst({ cacheName: 'spa-shell', networkTimeoutSeconds: 3 }), {
    denylist: [/^\/api\//],
  })
);

registerRoute(
  /\/api\/media\//,
  new CacheFirst({
    cacheName: 'media-cache',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200, 206] })],
  }),
  'GET'
);
