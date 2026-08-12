// Runtime-caching service worker - no build-time precache manifest (this repo has no PWA
// bundler plugin), so it only helps from a page's second visit onward: once a route (and the
// dynamically-imported preflop solver JSON chunk it pulls in - see solverLookup.ts) has been
// fetched once with a signal, it keeps working with no/poor signal after that, which is the
// actual failure mode this targets (a card room's Wi-Fi/cell reception, not a cold first load).
const CACHE_NAME = "pokergto-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept cross-origin (Supabase, Anthropic, Google AI, ...) or this app's own API
  // routes - those need a fresh, possibly-authenticated response, never a stale cached one.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Network-first for page navigations so a signed-in user always sees current data when
    // online; cache-as-you-go so the same page still opens (from cache) with no signal, falling
    // back to the cached home page if this exact route was never visited.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon") || url.pathname === "/manifest.json";
  if (!isStaticAsset) return;

  // Cache-first for content-hashed Next.js build assets (including the solver JSON's own chunk)
  // - they're immutable per URL, so a cache hit never goes stale.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
