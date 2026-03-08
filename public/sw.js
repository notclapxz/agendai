// Service Worker — Agenda Legal PWA
// Manejo de push notifications + cache básico offline

const CACHE_NAME = 'agenda-legal-v1'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Install: pre-cache íconos y manifest ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first, fallback a cache para assets estáticos ─────────────
self.addEventListener('fetch', (event) => {
  // Solo interceptar requests del mismo origen — nunca cross-origin (supabase.co, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear solo assets estáticos exitosos
        if (response.ok && STATIC_ASSETS.some((a) => event.request.url.endsWith(a))) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? Response.error())
      )
  )
})

// ── Push: mostrar notificación nativa ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: '📋 Agenda Legal',
    body: 'Tenés tareas pendientes',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'agenda-legal',
    data: { url: '/agenda' },
  }

  try {
    const parsed = event.data?.json()
    if (parsed) payload = { ...payload, ...parsed }
  } catch {
    // payload por defecto si el JSON no es válido
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      requireInteraction: false,
      silent: false,
      data: payload.data,
    })
  )
})

// ── Notification click: enfocar o abrir la app ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/agenda'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/agenda') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
