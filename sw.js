// Service worker — cache offline (app shell). Dados ficam no IndexedDB.
const CACHE = "kratos-v1";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js", "./js/db.js", "./js/data.js", "./js/charts.js",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// stale-while-revalidate para os próprios arquivos; rede para o resto (ex: fontes)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then((cached) => {
      const net = fetch(e.request).then((res) => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    }));
  } else {
    // recursos externos (Google Fonts): tenta cache, cai pra rede
    e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, copy)).catch(() => {}); return res;
    }).catch(() => c)));
  }
});
