// Service Worker – Offline Fallback für Garmin Training Dashboard
const CACHE = 'training-v1'

// Statische Assets cachen beim Install
const PRECACHE = [
  '/dashboard',
  '/nutrition',
  '/strength',
  '/trends',
  '/settings',
  '/manifest.json',
]

// API-Routes die gecacht werden sollen (stale-while-revalidate)
const API_CACHE_ROUTES = [
  '/api/readiness',
  '/api/dashboard',
  '/api/daily-input',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Nur GET-Requests cachen
  if (request.method !== 'GET') return

  // Next.js interne Routen überspringen
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname.startsWith('/api/auth/')) return

  // API-Routes: network-first mit Cache-Fallback
  if (url.pathname.startsWith('/api/') && API_CACHE_ROUTES.some(r => url.pathname.startsWith(r))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then(cached => {
          if (cached) return cached
          return new Response(JSON.stringify({ error: 'Offline – zeige gecachte Daten', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }))
    )
    return
  }

  // Seiten: network-first mit Offline-Fallback auf gecachte Version
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request) || caches.match('/dashboard'))
    )
    return
  }

  // Alles andere: Cache-first (statische Assets)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  )
})
