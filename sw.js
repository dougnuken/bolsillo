/* Service Worker mínimo de Bolsillo.
   El offline completo con precache llega en T9; aquí solo:
   - install: activarse de inmediato (skipWaiting)
   - activate: tomar control (clients.claim) y limpiar caches viejos
   - fetch: navegación => network-first con fallback a caché SOLO si la red falla;
            el resto => passthrough (no interceptar).
   Rutas relativas: funciona bajo cualquier subpath. */

const CACHE = 'bolsillo-shell-v1';

self.addEventListener('install', () => {
  // Activar esta versión sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borrar caches de versiones anteriores de Bolsillo.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('bolsillo-') && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      // Tomar control de las páginas ya abiertas.
      await self.clients.claim();
    })(),
  );
});

// ¿Es una petición de navegación (carga de documento HTML)?
function esNavegacion(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo tocamos navegaciones; el resto pasa directo a la red.
  if (!esNavegacion(request)) return;

  event.respondWith(
    (async () => {
      try {
        // Network-first: intentamos la red primero.
        const respuesta = await fetch(request);
        // Guardamos una copia como fallback para una futura pantalla offline.
        const cache = await caches.open(CACHE);
        cache.put(request, respuesta.clone());
        return respuesta;
      } catch (err) {
        // Sin red: servimos lo último cacheado si existe.
        const cache = await caches.open(CACHE);
        const cacheada = await cache.match(request);
        if (cacheada) return cacheada;
        throw err;
      }
    })(),
  );
});
