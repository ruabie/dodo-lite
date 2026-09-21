const CACHE_NAME = "dodo-v54-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./css/dodo.css",
  "./js/storage.js",
  "./js/urgency-engine.js",
  "./js/character-engine.js",
  "./js/notification-manager.js",
  "./js/app.js",
  "./dodo-v53-icon-192.png",
  "./dodo-v53-icon-512.png",
  "./assets/dodo_calm@2x.png",
  "./assets/dodo_notice@2x.png",
  "./assets/dodo_urgent@2x.png",
  "./assets/dodo_danger@2x.png",
  "./assets/dodo_done@2x.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "差不多可以开始啦。" }; }
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(payload.title || "小待 Dodo", {
    body: payload.body || "差不多可以开始啦。",
    icon: payload.icon || "./dodo-v53-icon-192.png",
    badge: payload.badge || "./dodo-v53-icon-192.png",
    tag: payload.tag || `dodo-${data.taskId || "reminder"}-${data.kind || "notice"}`,
    silent: payload.silent !== false,
    renotify: false,
    data: { url: data.url || "./", taskId: data.taskId || null, kind: data.kind || "notice" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "./", self.registration.scope);
  if (data.taskId) target.searchParams.set("task", data.taskId);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target.href) : undefined;
    })
  );
});
