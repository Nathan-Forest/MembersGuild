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
  if (event.request.url.includes('/api/')) return

  // Next.js static chunks — cache first
  if (event.request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached ??
        fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(event.request, clone))
          }
          return res
        })
      )
    )
    return
  }

  // Pages — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok && !res.url.includes('/api/manifest')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})