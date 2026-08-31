// spendi service worker — caches the app so it opens with no internet
const CACHE = "spendi-v4";
const APP_SHELL = ["./", "./index.html"];
// How long to wait for the network before falling back to the cached copy.
const NET_TIMEOUT = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // "reload" bypasses the browser's HTTP cache, which GitHub Pages sets to
      // 10 minutes — without it a deploy can cache the previous version's files.
      c.addAll(APP_SHELL.map((u) => new Request(u, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first with a short timeout, so a deploy shows up the next time the app
// is opened rather than the time after that, while no signal still opens instantly.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Exchange-rate lookups are cross-origin: leave them alone so a fetched rate
  // is never answered from the cache.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(req);

      const fromNetwork = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => null);

      if (!cached) return (await fromNetwork) || Response.error();

      const timeout = new Promise((r) => setTimeout(() => r(null), NET_TIMEOUT));
      return (await Promise.race([fromNetwork, timeout])) || cached;
    })()
  );
});
