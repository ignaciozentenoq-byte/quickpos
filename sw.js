var CACHE_NAME = 'quickpos-v4';
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

// Activar — limpiar caches antiguos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', function(e) {
  // No cachear requests a FacturaCL API
  if (e.request.url.includes('/api/') || e.request.url.includes('/health')) {
    return;
  }

  e.respondWith(
    fetch(e.request).then(function(res) {
      // Cachear respuesta exitosa
      if (res.ok) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return res;
    }).catch(function() {
      // Sin red — servir desde cache
      return caches.match(e.request);
    })
  );
});
