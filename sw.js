const CACHE = "arcade-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon192.png",
];

self.addEventListener("install", (e)=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e)=>{
  const req = e.request;
  e.respondWith((async ()=>{
    const cached = await caches.match(req);
    if(cached) return cached;

    try{
      const fresh = await fetch(req);
      return fresh;
    }catch{
      // offline fallback: yritä etusivu
      const fallback = await caches.match("./index.html");
      return fallback || new Response("Offline", { status: 200, headers: { "Content-Type":"text/plain" } });
    }
  })());
});
