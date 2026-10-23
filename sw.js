/*
 * Service Worker para Soluasistencia - Formulario de Siniestros
 *
 * Manejo de versiones
 * -------------------
 * - La versión publicada vive SOLO en version.json.
 * - La página registra este archivo como `sw.js?v=X.Y.Z`. Cada versión guarda en su
 *   propio caché (`siniestros-vX.Y.Z`) TODOS sus archivos, y la app se sirve siempre
 *   desde ese caché: abre al instante, funciona sin conexión y nunca mezcla un
 *   index.html nuevo con una plantilla o librerías de otra versión.
 * - Cuando la página detecta en version.json una versión distinta, registra el SW de
 *   esa versión: el navegador la descarga completa en segundo plano y queda "en
 *   espera" hasta que el usuario toca Actualizar (mensaje SKIP_WAITING) o se cierran
 *   todas las pestañas. Al activarse se borran los cachés de versiones anteriores.
 */

const SW_URL = new URL(self.location.href);
const CACHE_VERSION = SW_URL.searchParams.get("v") || "dev";
const CACHE_PREFIX = "siniestros-v";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Archivos locales que forman una versión. Si alguno falla, falla la instalación
// y el navegador lo reintenta en la próxima revisión de versión.
const PRECACHE_LOCAL = [
  "./",
  "./index.html",
  "./version.json",
  "./plantilla.pdf",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

// Externos con versión fija (no cambian): se reutilizan del caché anterior si ya están.
const PRECACHE_EXTERNAL = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js",
  "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js",
  "https://soluasistencia.com/wp-content/uploads/2024/11/logo_solu.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // La versión se arma en un caché temporal: si algo falla, el caché que está
    // usando la app (aunque tenga el mismo nombre de versión) no se toca.
    const stagingName = `${CACHE_NAME}-instalando`;
    await caches.delete(stagingName);
    const staging = await caches.open(stagingName);
    try {
      // cache:"reload" salta la caché HTTP del navegador (GitHub Pages da max-age=600):
      // sin esto, la versión nueva podía guardarse con archivos de la anterior.
      await staging.addAll(PRECACHE_LOCAL.map((url) => new Request(url, { cache: "reload" })));

      // Si el servidor entrega otra versión (despliegue a medio propagar), se aborta.
      if (CACHE_VERSION !== "dev") {
        const res = await staging.match("./version.json");
        const info = res ? await res.json() : null;
        if (!info || info.version !== CACHE_VERSION) {
          throw new Error(`[SW] version.json (${info && info.version}) no coincide con ${CACHE_VERSION}`);
        }
      }

      await Promise.allSettled(PRECACHE_EXTERNAL.map(async (url) => {
        try {
          // Una respuesta opaca no deja ver si fue un error: esas se vuelven a descargar
          const previous = await caches.match(url);
          if (previous && previous.type !== "opaque") {
            await staging.put(url, previous);
            return;
          }
          let res = await fetch(url, { mode: "cors" }).catch(() => null);
          if (!res || !res.ok) res = await fetch(url, { mode: "no-cors" });
          if (res.ok || res.type === "opaque") await staging.put(url, res);
        } catch (e) {
          console.warn("[SW] No se pudo precachear", url, e);
        }
      }));

      // Todo listo: pasa completo al caché definitivo de esta versión
      await caches.delete(CACHE_NAME);
      const cache = await caches.open(CACHE_NAME);
      for (const request of await staging.keys()) {
        await cache.put(request, await staging.match(request));
      }
    } finally {
      await caches.delete(stagingName);
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // El propio SW lo maneja el navegador
  if (sameOrigin && url.pathname.endsWith("/sw.js")) return;

  // "¿Hay versión nueva?": siempre a la red, nunca al caché
  if (sameOrigin && url.pathname.endsWith("/version.json") && url.searchParams.has("check")) {
    event.respondWith(fetch(new Request(url.href, { cache: "no-store" })));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Abrir la app: el index.html de ESTA versión (también sin conexión)
    if (request.mode === "navigate" && sameOrigin && /\/(index\.html)?$/.test(url.pathname)) {
      const page = await cache.match("./index.html");
      if (page) return page;
    }

    const cached = await cache.match(request, { ignoreSearch: sameOrigin });
    if (cached) return cached;

    const response = await fetch(request);
    // Recursos externos que no estaban en la lista (p. ej. fuentes): se guardan al vuelo
    if (!sameOrigin && response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});

// Permite que la página active la versión en espera cuando el usuario toca Actualizar.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
