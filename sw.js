// Service worker — cache offline (app shell). Dados ficam no IndexedDB.
const CACHE = "kratos-v5";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js", "./js/db.js", "./js/data.js", "./js/charts.js", "./js/celebrate.js",
  "./js/saga.js", "./js/spartan.js",
  "./fonts/cinzel-latin.woff2", "./fonts/inter-latin.woff2",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // cache:"reload" força buscar da rede, sem passar pelo HTTP cache do browser —
  // evita precachear assets velhos numa atualização de versão.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// stale-while-revalidate para os próprios arquivos; rede para o resto
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(async (cached) => {
      if (cached) {
        // revalida em segundo plano
        fetch(e.request).then((res) => {
          if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(e.request);
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      } catch {
        // offline e sem cache: navegação cai no app shell (ignora query string)
        if (e.request.mode === "navigate") {
          const shell = await caches.match("./index.html", { ignoreSearch: true });
          if (shell) return shell;
        }
        return Response.error();
      }
    }));
  } else {
    e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request).then((res) => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => c || Response.error())));
  }
});
