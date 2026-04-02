var CACHE_NAME = 'quickpos-v6';
var ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Instalar — cachear assets esenciales
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Cacheando assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar — limpiar caches antiguos y notificar clientes
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      // Notificar a todas las pestañas que hay nueva versión
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
      });
    })
  );
  self.clients.claim();
});

// Fetch — stale-while-revalidate para HTML, network-first para el resto
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // No cachear API ni health
  if (url.includes('/api/') || url.includes('/health')) {
    return;
  }

  // Para navegación (HTML) — stale-while-revalidate
  if (e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('.html')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var networkFetch = fetch(e.request).then(function(res) {
            if (res.ok) {
              cache.put(e.request, res.clone());
            }
            return res;
          }).catch(function() {
            return cached;
          });

          // Si hay cache, servir inmediatamente (stale) y actualizar en background
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Para otros assets — network first, fallback cache
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res.ok) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Escuchar mensajes del frontend
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      e.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
