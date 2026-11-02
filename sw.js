// Keeps a copy of the app on the phone, so it opens instantly and works with no signal.
// Each open shows the saved copy and quietly fetches a fresh one. If the page has changed, it tells
// the app, which reloads when it's safe. Only the app's own files go through here, never logged data.
const CACHE = "gym-buddy-v1";
const FILES = ["./", "manifest.webmanifest", "icon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
const PAGE_PATH = new URL("./", location).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Remembered as well as sent, because on a fast connection the new copy can arrive before the
// page has started and could hear about it. The page asks when it's ready.
let updateReady = false;

self.addEventListener("message", (event) => {
  if (event.data === "app-ready" && updateReady) event.source.postMessage("app-updated");
});

async function tellAppsIfChanged(saved, fresh) {
  if (!saved || (await saved.text()) === (await fresh.text())) return;
  updateReady = true;
  const apps = await self.clients.matchAll();
  apps.forEach((app) => app.postMessage("app-updated"));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  const isPage = event.request.mode === "navigate" || url.pathname === PAGE_PATH;
  if (event.request.mode === "navigate") updateReady = false; // this load gets the latest saved copy
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const key = isPage ? "./" : event.request;
    const saved = await cache.match(key, { ignoreSearch: true });
    const savedForCompare = saved && saved.clone(); // the original gets sent to the app below
    // "no-cache" asks GitHub whether there's a newer copy, rather than reusing the browser's own
    // copy, which GitHub says is fine to keep for 10 minutes and would delay updates.
    const fresh = fetch(event.request.url, { cache: "no-cache" }).then(async (response) => {
      if (response.ok) {
        await cache.put(key, response.clone());
        if (isPage) await tellAppsIfChanged(savedForCompare, response.clone());
      }
      return response;
    });
    if (saved) {
      event.waitUntil(fresh.catch(() => {}));
      return saved;
    }
    return fresh;
  }));
});
