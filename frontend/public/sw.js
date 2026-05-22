const CACHE = 'membersguild-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  // API calls — always network, never cache
  if (event.request.url.includes('/api/')) return

  // Next.js static chunks — cache first (immutable content hashes)
  if (event.request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ??
        fetch(event.request).then(res => {
          caches.open(CACHE).then(c => c.put(event.request, res.clone()))
          return res
        })
      )
    )
    return
  }

  // Pages — network first, cache as fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        caches.open(CACHE).then(c => c.put(event.request, res.clone()))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})