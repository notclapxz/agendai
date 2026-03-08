# Frontend Context — agenda-legal

Última actualización: 2026-02-12

## Estado

**PRODUCCIÓN LIVE** ✅ — `https://agenda.mlpperu.com`  
Todas las fases completadas. App en uso activo.

---

## Stack instalado

- Next.js 16.1.6 + React 19 (Turbopack)
- TypeScript strict + noUncheckedIndexedAccess
- Tailwind CSS 4 + shadcn/ui
- @supabase/ssr 0.6.x + @supabase/supabase-js 2.49.x
- @dnd-kit/core + @dnd-kit/sortable (drag & drop de tareas)
- date-fns 4.x · lucide-react · web-push 3.x
- Service Worker manual (`public/sw.js`) — sin next-pwa plugin

---

## Archivos clave

```
src/
├── app/
│   ├── layout.tsx               # PWA meta + script inline viewport height
│   ├── page.tsx                 # → redirect /agenda
│   ├── login/page.tsx           # username sin @, autoComplete off
│   ├── agenda/page.tsx          # Server Component + auth guard
│   └── api/push/
│       ├── subscribe/route.ts   # onConflict: 'user_id, endpoint'
│       └── unsubscribe/route.ts
├── components/
│   ├── ServiceWorkerRegister.tsx
│   └── agenda/
│       ├── AgendaLayout.tsx     # Layout principal, push, orientationchange
│       ├── DateNavigator.tsx    # Sidebar calendario (260px desktop)
│       ├── DayView.tsx          # Vista del día con secciones
│       ├── TaskItem.tsx         # Item con edición inline, lápiz+papelera siempre visibles
│       ├── SortableTaskItem.tsx # Wrapper dnd-kit para drag & drop
│       ├── TaskInput.tsx        # Input con auto-detección y prompt de hora
│       └── CarriedSection.tsx   # Sección tareas arrastradas
├── hooks/
│   ├── useTasks.ts              # CRUD + realtime + carry-over
│   └── usePush.ts               # Suscripción Web Push con VAPID
└── lib/
    ├── supabase/client.ts
    ├── supabase/server.ts
    ├── types/database.ts        # TaskType, Task, TaskInsert, TaskUpdate
    └── utils/
        ├── dates.ts             # isWorkingDay, toDateString (hora LOCAL), etc.
        ├── task-parser.ts       # parseTask + parseTimeInput (exportada)
        └── carry-over.ts        # performCarryOverIfNeeded (guard futuro)
public/
├── sw.js                        # Service Worker manual (push + cache)
├── manifest.json
└── icons/
supabase/functions/
├── daily-summary/index.ts       # cron 12:20 UTC Lun-Sáb → resumen + carry-over
└── event-reminder/index.ts      # cron cada 30 min 6-22h Lun-Sáb → reminders 1h/1d/3d
```

---

## Decisiones técnicas tomadas

| Decisión | Razón |
|---|---|
| Service Worker manual (`public/sw.js`) | `@ducanh2912/next-pwa` incompatible con Turbopack en producción |
| Script inline en `<head>` para `--app-h` | Elimina layout shift → sin parpadeo en barra Samsung en recarga |
| `orientationchange` (no `resize`) | `resize` dispara al abrir teclado → parpadeo negro en Samsung |
| `type="text"` en input de hora (no `type="time"`) | `type="time"` muestra AM/PM según locale del OS |
| Papelera siempre visible (sin hover-only) | En tablet no existe hover state |
| `task.time?.slice(0, 5)` en edit | PostgreSQL TIME devuelve `HH:MM:SS`, necesitamos `HH:MM` |
| `onConflict: 'user_id, endpoint'` | El UNIQUE constraint en push_subscriptions es compuesto |
| SW guard same-origin en fetch handler | Sin guard interceptaba requests a `supabase.co` → ERR_FAILED |
| `parseTimeInput` exportada desde task-parser | Reutilización entre TaskInput y TaskItem edit mode |

---

## Keywords de auto-detección (task-parser.ts)

| Texto al inicio | Tipo | Pide hora |
|---|---|---|
| `Audiencia` | Audiencia | ✅ |
| `Testimonial` | Audiencia | ✅ |
| `Indagatoria` | Audiencia | ✅ |
| `Declaracion testimonial` | Audiencia | ✅ |
| `Declaracion indagatoria` | Audiencia | ✅ |
| `Reunion` / `Reunión` | Reunion | ✅ |
| `Plazo` / `Vencimiento` | Plazo | ✅ |
| `Llamar` / `Llamada` | Llamada | ❌ |
| Cualquier otro texto | Tarea | ❌ |

---

## Bugs críticos resueltos

| Bug | Fix |
|---|---|
| `toDateString()` usaba `toISOString()` (UTC) → después de 7 PM Lima daba día siguiente | Usar `getFullYear/getMonth/getDate()` locales |
| Carry-over corría para fechas futuras | Guard `if (targetDate > today) return` |
| SW interceptaba requests a supabase.co | Guard `if (!event.request.url.startsWith(self.location.origin)) return` |
| Input hora edit mode mostraba `17:00:00` | `task.time?.slice(0, 5)` en init del estado |
| Layout shift en recarga → parpadeo Samsung | Script inline síncrono en `<head>` antes del primer paint |

---

## Infraestructura de notificaciones

- **VAPID keys**: configuradas en Vercel (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
- **Crons en Supabase (pg_cron)**:
  - `daily-summary`: `20 12 * * 1-6` (7:20 AM Lima)
  - `event-reminder`: `*/30 11-23,0-3 * * 1-6` (cada 30 min, 6-22h Lima)
- **push_subscriptions**: tabla activa, suscripción de tablet registrada
- **Funciona con app cerrada**: sí, siempre que Chrome/Samsung Internet esté en background

---

## Dispositivo target

**Samsung Galaxy Tab S10 FE SM-X520**
- 1152×720 CSS px landscape (DPR 2, físico 2304×1440)
- Browser: Chrome / Samsung Internet
- Firefox no soportado (incompatible con Supabase Realtime WSS)

---

## Próximas mejoras potenciales (backlog)

- Edición de tipo de tarea desde el modo edición
- Vista semanal / resumen de la semana
- Filtros en la lista de tareas
- Modo oscuro
