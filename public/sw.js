/*
 * School Pawa service worker.
 *  - App shell + offline page precached so the app opens with no signal.
 *  - /_next/static: cache-first (immutable, content-hashed).
 *  - Navigations: network-first, falling back to the cached page, then to /offline.
 *  - /api/*: never cached (student data must not sit in a shared cache).
 *  - Background Sync: asks open clients to flush the offline result queue.
 */
const VERSION = "sp-v1";
const SHELL = ["/", "/offline", "/manifest.webmanifest", "/icon.svg", "/icons/192", "/icons/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u)))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache public shell pages; never personalised pages.
          if (res.ok && (url.pathname === "/" || url.pathname === "/offline")) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "flush-queue") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => clients.forEach((c) => c.postMessage({ type: "flush-queue" }))),
    );
  }
});
