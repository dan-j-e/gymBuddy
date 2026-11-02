// Keeps a copy of the app on the phone, so it opens instantly and works with no signal.
// Each open shows the saved copy and quietly fetches a fresh one, so an update appears
// the open after it's downloaded. Only the app's own files go through here, never logged data.
const CACHE = "gym-buddy-v1";
const FILES = ["./", "manifest.webmanifest", "icon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const key = event.request.mode === "navigate" ? "./" : event.request;
    const saved = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(event.request).then((response) => {
      if (response.ok) cache.put(key, response.clone());
      return response;
    });
    if (saved) {
      event.waitUntil(fresh.catch(() => {}));
      return saved;
    }
    return fresh;
  }));
});
