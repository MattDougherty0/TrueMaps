/**
 * Service Worker for HuntMaps Web
 * Handles MBTiles tile serving and caching for hosted tiles
 */

const CACHE_NAME = 'huntmaps-tiles-v2';
const TILE_CACHE_PREFIX = '/api/tiles/';

// Hosted tile service domains to cache
const HOSTED_TILE_DOMAINS = [
  'basemap.nationalmap.gov',
  'server.arcgisonline.com',
  'tiles.opentopomap.org',
  'tile.openstreetmap.org'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - intercept tile requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle MBTiles tile requests (from IndexedDB)
  if (url.pathname.startsWith(TILE_CACHE_PREFIX)) {
    event.respondWith(handleTileRequest(url));
    return;
  }
  
  // Handle hosted tile requests (cache with network fallback)
  if (isHostedTileRequest(url)) {
    event.respondWith(handleHostedTileRequest(event.request));
    return;
  }
  
  // For other requests, use network-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

/**
 * Check if request is for a hosted tile service
 */
function isHostedTileRequest(url) {
  return HOSTED_TILE_DOMAINS.some(domain => url.hostname.includes(domain)) &&
         (url.pathname.includes('/tile/') || url.pathname.match(/\/\d+\/\d+\/\d+/));
}

/**
 * Handle hosted tile request with cache-first strategy
 */
async function handleHostedTileRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {
      // Ignore network errors for background update
    });
    return cachedResponse;
  }
  
  // Cache miss - fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful responses
      await cache.put(request, response.clone());
      // Cleanup old cache entries if needed
      await cleanupCache(cache);
    }
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch tile:', error);
    // Return transparent tile on network error
    return createTransparentTileResponse();
  }
}

/**
 * Cleanup cache to stay within size limits
 */
async function cleanupCache(cache) {
  const keys = await cache.keys();
  if (keys.length < 1000) return; // Don't cleanup if cache is small
  
  // Remove oldest 10% of entries
  const toDelete = keys.slice(0, Math.floor(keys.length * 0.1));
  await Promise.all(toDelete.map(key => cache.delete(key)));
}

/**
 * Create transparent tile response
 */
function createTransparentTileResponse() {
  const transparentTile = base64ToArrayBuffer(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
  );
  return new Response(transparentTile, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Handle MBTiles tile request
 * Format: /api/tiles/{tileset}/{z}/{x}/{y}.png
 */
async function handleTileRequest(url) {
  try {
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts: ['api', 'tiles', 'tileset', 'z', 'x', 'y.png']
    if (pathParts.length < 6) {
      return new Response('Invalid tile URL', { status: 400 });
    }
    
    const tileset = pathParts[2];
    const z = parseInt(pathParts[3], 10);
    const x = parseInt(pathParts[4], 10);
    const yStr = pathParts[5].replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const y = parseInt(yStr, 10);
    
    if (isNaN(z) || isNaN(x) || isNaN(y)) {
      return new Response('Invalid tile coordinates', { status: 400 });
    }
    
    // Try to get tile from IndexedDB
    const tile = await getTileFromIndexedDB(tileset, z, x, y);
    
    if (tile) {
      return new Response(tile.data, {
        headers: {
          'Content-Type': tile.mimeType || 'image/png',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }
    
    // Return transparent tile if not found
    return createTransparentTileResponse();
  } catch (error) {
    console.error('[SW] Error handling tile request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Get tile from IndexedDB
 * Note: The tiles are stored with TMS Y coordinates (as they come from MBTiles)
 * But OpenLayers uses standard Y coordinates, so we need to convert
 */
async function getTileFromIndexedDB(tileset, z, x, y) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('huntmaps-mbtiles', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      
      // Check if object store exists
      if (!db.objectStoreNames.contains('tiles')) {
        resolve(null);
        return;
      }
      
      const transaction = db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      
      // MBTiles stores tiles with TMS Y coordinate
      // OpenLayers requests use standard Y coordinate
      // So we need to convert: TMS_Y = (2^z - 1) - Y
      const tmsY = Math.pow(2, z) - 1 - y;
      const key = `${tileset}/${z}/${x}/${tmsY}`;
      
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        if (result && result.tile_data) {
          // Convert ArrayBuffer to Uint8Array for Response
          const data = result.tile_data instanceof ArrayBuffer 
            ? result.tile_data 
            : new Uint8Array(result.tile_data).buffer;
          resolve({
            data: data,
            mimeType: result.mime_type || 'image/png',
          });
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tiles')) {
        const tilesStore = db.createObjectStore('tiles', { keyPath: 'key' });
        tilesStore.createIndex('tileset', 'tileset', { unique: false });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        const metadataStore = db.createObjectStore('metadata', { keyPath: ['tileset', 'name'] });
        metadataStore.createIndex('tileset', 'tileset', { unique: false });
      }
    };
  });
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

