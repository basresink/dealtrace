// Service worker van Dealtrace (P27, 8.14): statische bestanden 30 dagen uit de cache,
// API-GET netwerk eerst met terugval op de laatst bekende versie. Schrijfacties gaan
// nooit via de cache; die lopen via de wachtrij in de app (P01). Het dagpakket is P30.
const STATISCH = 'dt-statisch-v1'
const API = 'dt-api-v1'
const DERTIG_DAGEN = 30 * 24 * 3600 * 1000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![STATISCH, API].includes(k)) await caches.delete(k)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const url = new URL(r.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/sessie')) return
    e.respondWith((async () => {
      try {
        const res = await fetch(r)
        if (res.ok) (await caches.open(API)).put(r, res.clone())
        return res
      } catch {
        const c = await (await caches.open(API)).match(r)
        if (c) return c
        throw new Error('offline')
      }
    })())
    return
  }
  if (url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/iconen/')) {
    e.respondWith((async () => {
      const cache = await caches.open(STATISCH)
      const c = await cache.match(r)
      if (c && Date.now() - Number(c.headers.get('x-dt-op') ?? 0) < DERTIG_DAGEN) return c
      const res = await fetch(r)
      if (res.ok) {
        const h = new Headers(res.headers); h.set('x-dt-op', String(Date.now()))
        cache.put(r, new Response(await res.clone().blob(), { status: res.status, headers: h }))
      }
      return res
    })())
  }
})
