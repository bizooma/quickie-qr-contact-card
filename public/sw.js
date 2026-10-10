// ContactKickstart service worker.
// Strategy: hashed /assets/ files are immutable → cache-first; brand/static
// files → stale-while-revalidate; page navigations → network-first with the
// cached /app shell as the offline fallback. Data (Supabase) is cross-origin
// and never intercepted, so nothing stale is ever shown as live data.
const VERSION = "v2";
const SHELL = `ck-shell-${VERSION}`;
const ASSETS = `ck-assets-${VERSION}`;
const STATIC = `ck-static-${VERSION}`;
const KEEP = [SHELL, ASSETS, STATIC];

const PRECACHE = [
  "/app",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/brand/logo-wordmark.webp",
  "/brand/logo-badge.webp",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

async function navigation(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(SHELL);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Any in-app route can boot from the cached /app shell (the router takes
    // over client-side); other pages get a plain offline notice.
    const url = new URL(request.url);
    if (url.pathname.startsWith("/app")) {
      const shell = await caches.match("/app");
      if (shell) return shell;
    }
    return new Response(
      "<!doctype html><title>Offline</title><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><body style=\"font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#FAF8F5;color:#111827\"><div style=\"text-align:center\"><h1 style=\"font-size:1.25rem\">You're offline</h1><p style=\"color:#6b7280\">ContactKickstart needs a connection for this page.</p></div></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

// Pushes arrive without a payload (no encryption needed server-side), so the
// notification text is generic; tapping it opens the contacts list.
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("New contact captured 🎉", {
      body: "Someone just shared their details with you. Tap to see who.",
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: "ck-shareback",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const target = "/app/contacts";
      for (const w of wins) {
        if (new URL(w.url).pathname.startsWith("/app")) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC));
  }
});
