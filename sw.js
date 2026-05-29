/*
 * Service Worker para Soluasistencia - Formulario de Siniestros
 *
 * El nombre del caché se construye con la versión que llega en el query string
 * de la URL del SW (registrado como `sw.js?v=X.Y.Z`). Cuando el index.html
 * cambia APP_VERSION, la URL del SW cambia y el navegador instala un SW nuevo
 * que crea un caché con el nuevo nombre y borra el anterior en `activate`.
 */

const SW_URL = new URL(self.location.href);
const CACHE_VERSION = SW_URL.searchParams.get("v") || "dev";
const CACHE_NAME = `siniestros-v${CACHE_VERSION}`;

// Archivos locales que deben quedar cacheados al instalar el SW.
const PRECACHE_LOCAL = [
  "./",
  "./index.html",
  "./plantilla.pdf",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

// CDNs externos. Se intentan cachear; si fallan no rompemos la instalación.
const PRECACHE_EXTERNAL = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js",
  "https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Locales: deben estar todos. Si alguno falla, falla la instalación.
    await cache.addAll(PRECACHE_LOCAL);
    // Externos: intentamos uno por uno y dejamos pasar errores.
    await Promise.allSettled(
      PRECACHE_EXTERNAL.map(async (url) => {
        try {
          const res = await fetch(url, { mode: "no-cors" });
          await cache.put(url, res);
        } catch (e) {
          console.warn("[SW] No se pudo precachear", url, e);
        }
      })
    );
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("siniestros-v") && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // No cachear el propio SW ni el manifest (queremos que el browser detecte
  // cambios rápido al actualizar versión).
  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/manifest.json")) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) {
      // Refresh in background (stale-while-revalidate)
      fetch(event.request).then((res) => {
        if (res && res.status === 200) cache.put(event.request, res.clone());
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response && response.status === 200) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (e) {
      // Sin red y sin caché: si era HTML devolvemos el index como fallback.
      if (event.request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});

// Permite que el cliente fuerce el SW nuevo a tomar control inmediatamente.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
