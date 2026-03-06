const APP_VERSION = 'v5-institucional-pwa';
const CACHE_STATIC = `gestorpro-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `gestorpro-dynamic-${APP_VERSION}`;

const ASSETS_ESTATICOS = [
    './',
    './index.html',
    './css/styles.css',
    './css/utilities.css',
    './js/controller.js',
    './js/model.js',
    './js/view.js',
    './js/utils/storage.js',
    './js/utils/backup.js',
    './js/utils/events.js',
    './js/utils/CommandManager.js',
    './js/utils/MigrationManager.js',
    './js/utils/financial.js',
    './js/utils/helpers.js',
    './js/views/ChartRenderer.js',
    './js/views/ToastManager.js',
    './js/views/UIMetrics.js',
    './js/chartWorker.js',
    './js/worker.js',
    './assets/sprite.svg',
    './manifest.json'
];

// Instalación: Pre-cacheamos los recursos críticos
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                console.log('[SW] Cacheando recursos estáticos');
                return cache.addAll(ASSETS_ESTATICOS);
            })
    );
});

// Activación: Limpieza de cachés de versiones anteriores
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_STATIC && key !== CACHE_DYNAMIC) {
                        console.log('[SW] Eliminando caché antiguo:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de Intercepción de Peticiones (Fetch)
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // Estrategia específica para el SVG: Cache First estricto
    if (requestUrl.pathname.endsWith('sprite.svg')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_STATIC).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Estrategia para peticiones de APIs externas (Ej: Dólar, Precios de Bolsa)
    // Network First, cae a caché dinámico si falla internet
    if (requestUrl.origin !== location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    return caches.open(CACHE_DYNAMIC).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Estrategia por defecto para la App (Stale-While-Revalidate)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                caches.open(CACHE_STATIC).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                // Si falla la red y no hay caché, intentamos servir el index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
            
            return cachedResponse || fetchPromise;
        })
    );
});