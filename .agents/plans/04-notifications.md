# Fase 4 · Notificaciones Web Push

Duración estimada: 2 días  
Dependencias: Fase 3 completa

---

## Objetivos

El abogado recibe notificaciones nativas en su tablet Samsung y PC Windows sin abrir la app.

---

## Arquitectura de notificaciones

```
Supabase Edge Function (cron)
  → Consulta tasks con hora próxima
  → Busca push_subscriptions del usuario
  → Envía Web Push via VAPID
    → Llega al Service Worker del dispositivo
      → Muestra notificación nativa del OS
```

---

## Paso 1 · Generar VAPID Keys

```bash
# Ejecutar UNA sola vez, guardar en .env.local y en Vercel Dashboard
npx web-push generate-vapid-keys
```

Resultado:
```
Public Key: BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Paso 2 · Service Worker

El service worker ya existe por next-pwa. Extenderlo para manejar push:

```javascript
// public/sw.js (generado por next-pwa + custom push handler)

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const { title, body, icon, badge, tag } = data
  
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/icons/icon-192.png',
      badge: badge ?? '/icons/icon-192.png',
      tag: tag ?? 'agenda-legal',     // evita duplicados en pantalla
      requireInteraction: false,
      vibrate: [200, 100, 200],       // patrón para Android
      data: { url: data.url ?? '/agenda' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url ?? '/agenda')
  )
})
```

---

## Paso 3 · API Routes

### `src/app/api/push/subscribe/route.ts`
```typescript
// POST — guarda la subscripción en push_subscriptions
// Body: { endpoint, p256dh, auth, deviceLabel }
// Usa Supabase server client para insertar con user_id del auth context
// Upsert por endpoint (si ya existe, no falla)
```

### `src/app/api/push/unsubscribe/route.ts`
```typescript
// DELETE — elimina la subscripción por endpoint
// Body: { endpoint }
```

---

## Paso 4 · Hook usePush

```typescript
// src/hooks/usePush.ts

interface UsePushReturn {
  isSubscribed: boolean
  isSupported: boolean
  subscribe: (deviceLabel?: string) => Promise<void>
  unsubscribe: () => Promise<void>
}

// Comportamiento:
// 1. Verificar si 'Notification' y 'PushManager' existen en window
// 2. Verificar estado actual: Notification.permission
// 3. subscribe():
//    a. navigator.serviceWorker.ready
//    b. registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
//    c. POST /api/push/subscribe con los datos de la subscription
// 4. isSubscribed: verificar si hay subscription activa en el SW
```

### UI del botón

En un settings panel accesible desde el avatar/header:

```
🔔 Notificaciones
  [Activar en este dispositivo]
  
  Dispositivos activos:
  • Tablet Samsung ✓ [Desactivar]
  • PC Oficina ✓ [Desactivar]
```

---

## Paso 5 · Edge Functions (Supabase)

### `supabase/functions/daily-summary/index.ts`

**Cron**: `20 12 * * 1-6` (12:20 UTC = 07:20 Lima, Lunes a Sábado)

```typescript
// Algoritmo:
// 1. Obtener fecha de hoy en Lima (UTC-5)
// 2. Si es domingo, terminar (cron ya filtra, pero doble check)
// 3. Query: todas las subscripciones (push_subscriptions)
//    Por cada subscripción:
//    a. Obtener tasks del día (date = hoy) para ese user_id
//    b. Contar total y tareas con hora
//    c. Verificar notifications_log: ¿ya se envió 'summary' hoy?
//    d. Si no → construir mensaje + enviar Web Push + insertar en notifications_log

// Formato del mensaje:
// title: "📋 Agenda de hoy — Miércoles 11/02"
// body: "18 tareas · Audiencia Gutierrez 09:00 · Reunión Moreno 15:00"
//   (si no hay timed events: "18 tareas pendientes")

// Web Push usando web-push library con SERVICE_ROLE_KEY para acceso DB
```

### `supabase/functions/event-reminder/index.ts`

**Cron**: `*/30 * * * 1-6` (cada 30 min, Lunes a Sábado)

```typescript
// Algoritmo:
// 1. NOW() en Lima timezone
// 2. Buscar timed tasks (time IS NOT NULL, completed = false) en:
//    - 3 días en el futuro (ventana: ±15 min de la hora de la tarea)
//      → tipo: 'reminder_3d'
//    - Mañana (mismo criterio de ventana)
//      → tipo: 'reminder_1d'  
//    - En los próximos 60-90 minutos
//      → tipo: 'reminder_1h'
// 3. Para cada task encontrada:
//    a. Verificar notifications_log: ¿ya se envió este tipo para esta task?
//    b. Si no → enviar Web Push + insertar en notifications_log
//    c. El UNIQUE constraint evita duplicados automáticamente

// Formato de mensajes por tipo:
// reminder_3d: "⚖️ En 3 días: Audiencia Gutierrez — Vie 13/02 a las 09:00"
// reminder_1d: "⚖️ Mañana: Audiencia Gutierrez — Jue 12/02 a las 09:00"
// reminder_1h: "⚖️ En 1 hora: Audiencia Gutierrez — 09:00"

// Ejemplos reales basados en OneNote del abogado:
// "⚖️ Mañana: Audiencia Roo"
// "🤝 En 1 hora: Reunión Carlos Moreno"
```

---

## Configurar crons en Supabase

En Supabase Dashboard → Database → Extensions → habilitar `pg_cron`

```sql
-- Resumen diario 7:20 AM Lima (12:20 UTC)
SELECT cron.schedule(
  'daily-summary',
  '20 12 * * 1-6',
  $$ SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/daily-summary',
    headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  ) $$
);

-- Recordatorio de eventos (cada 30 min, L-S)
SELECT cron.schedule(
  'event-reminder',
  '*/30 6-22 * * 1-6',
  $$ SELECT net.http_post(
    url := 'https://[PROJECT_ID].supabase.co/functions/v1/event-reminder',
    headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  ) $$
);
```

> **Nota**: El cron de event-reminder corre de 6 AM a 10 PM Lima (11 AM a 3 AM UTC) — no manda notificaciones de madrugada.

---

## Test de notificaciones

1. Instalar PWA en Chrome (PC)
2. Ir a Settings → Activar notificaciones en este dispositivo
3. Test manual desde Supabase Edge Function: Functions → Invoke
4. Verificar que llega la notificación en el OS
5. Repetir en tablet Samsung (instalar PWA desde Chrome)

---

## Checklist de done

- [ ] VAPID keys generadas y en variables de entorno
- [ ] Service Worker maneja eventos `push` y `notificationclick`
- [ ] Botón "Activar notificaciones" funciona en Chrome PC
- [ ] Botón "Activar notificaciones" funciona en Chrome Samsung tablet
- [ ] Edge Function daily-summary deployada y testeable manualmente
- [ ] Edge Function event-reminder deployada y testeable manualmente
- [ ] Crons configurados en Supabase con pg_cron
- [ ] notifications_log evita duplicados (verificar con prueba doble-invoke)
- [ ] Notificación clickeable abre la app en la fecha correcta
