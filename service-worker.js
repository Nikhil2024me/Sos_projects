/**
 * SOS Connect Pro - Service Worker
 * Enables offline functionality and background sync
 */

const CACHE_NAME = 'sos-connect-pro-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/script.js',
    '/styles.css',
    '/css/features.css',
    '/manifest.json'
];

const EXTERNAL_ASSETS = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            // Cache static assets first
            return cache.addAll(STATIC_ASSETS).then(() => {
                // Try to cache external assets (don't fail if they're not available)
                return Promise.allSettled(
                    EXTERNAL_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.log(`[SW] Failed to cache external: ${url}`, err)
                        )
                    )
                );
            });
        }).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle API requests differently (network first)
    if (url.pathname.includes('/api/') || 
        url.hostname.includes('api.open-meteo.com') ||
        url.hostname.includes('api.bigdatacloud.net') ||
        url.hostname.includes('generativelanguage.googleapis.com')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // For static assets, use cache first strategy
    event.respondWith(cacheFirst(request));
});

// Cache first strategy - for static assets
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Fetch failed:', error);
        // Return offline fallback for HTML pages
        if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
        }
        throw error;
    }
}

// Network first strategy - for API requests
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-sensor-data') {
        event.waitUntil(syncSensorData());
    }
    if (event.tag === 'sync-emergency-alerts') {
        event.waitUntil(syncEmergencyAlerts());
    }
});

async function syncSensorData() {
    try {
        const pendingData = await getPendingData('sensor-data');
        if (pendingData && pendingData.length > 0) {
            // Send pending sensor data when back online
            console.log('[SW] Syncing sensor data:', pendingData.length, 'items');
            await clearPendingData('sensor-data');
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

async function syncEmergencyAlerts() {
    try {
        const pendingAlerts = await getPendingData('emergency-alerts');
        if (pendingAlerts && pendingAlerts.length > 0) {
            console.log('[SW] Syncing emergency alerts:', pendingAlerts.length, 'items');
            await clearPendingData('emergency-alerts');
        }
    } catch (error) {
        console.error('[SW] Emergency sync failed:', error);
    }
}

// IndexedDB helpers for background sync
async function getPendingData(storeName) {
    // Simplified - actual implementation would use IndexedDB
    return [];
}

async function clearPendingData(storeName) {
    // Simplified - actual implementation would use IndexedDB
    return true;
}

// Push notification handler
self.addEventListener('push', (event) => {
    let data = { title: 'SOS Connect Pro', body: 'New notification', icon: '🔔' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body || data.message,
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: data.tag || 'sos-notification',
        data: data,
        vibrate: [100, 50, 100],
        actions: data.actions || [
            { action: 'view', title: 'View', icon: '👁️' },
            { action: 'dismiss', title: 'Dismiss', icon: '✕' }
        ],
        requireInteraction: data.priority === 'high'
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const action = event.action;
    const data = event.notification.data;
    
    if (action === 'dismiss') {
        return;
    }
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url.includes('/index.html') && 'focus' in client) {
                        client.postMessage({
                            type: 'notification-click',
                            data: data
                        });
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    const url = data?.url || '/index.html';
                    return clients.openWindow(url);
                }
            })
    );
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll(urls);
            })
        );
    }
});

console.log('[SW] Service Worker loaded');
