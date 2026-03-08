# Arquitectura del Sistema — agenda-legal

**Estado**: Producción live — `https://agenda.mlpperu.com`

## Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) | SSR + PWA + API Routes en uno |
| UI | React 19 + TypeScript strict | Stack type-safe, React Compiler |
| Estilos | Tailwind CSS 4 + shadcn/ui | Componentes listos, design tokens |
| Base de datos | Supabase (PostgreSQL) | Sync multi-device, Auth, RLS, Realtime |
| Notificaciones | Web Push API + Supabase Edge Functions + pg_cron | Push nativo Android Chrome + Windows |
| Deploy | Vercel (free tier) | CI/CD, dominio custom, edge network |
| Dominio | agenda.mlpperu.com (CNAME → Vercel) | Subdominio, no rompe WordPress existente |
| PWA | Service Worker manual (`public/sw.js`) | next-pwa incompatible con Turbopack |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Touch-friendly, accesible |

---

## Diagrama de capas

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (PWA)                         │
│  Samsung Tab S10 FE (Chrome)  ·  PC Windows (Chrome)     │
│  React 19 · Tailwind · shadcn/ui · dnd-kit               │
│  Service Worker (Web Push receiver + cache estático)     │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS (Supabase JS client)
┌─────────────────▼───────────────────────────────────────┐
│                   SUPABASE                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Auth        │  │  PostgreSQL  │  │ Edge Functions│  │
│  │  (email/pw)  │  │  tasks       │  │  daily-summary│  │
│  │              │  │  push_subs   │  │  event-remind │  │
│  │              │  │  notif_log   │  │  (pg_cron)    │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                  │ Web Push (FCM / WNS)
┌─────────────────▼───────────────────────────────────────┐
│          DISPOSITIVOS DEL USUARIO                        │
│  Notificaciones nativas Android + Windows                │
│  Funcionan con la app cerrada                            │
└─────────────────────────────────────────────────────────┘
```

---

## Modelo de datos

```
tasks
 ├── id (uuid), user_id (uuid), date (DATE — YYYY-MM-DD, nunca domingo)
 ├── title (text), type (Tarea|Audiencia|Reunion|Llamada|Plazo|Otro)
 ├── time (TIME nullable — HH:MM, solo si tiene hora)
 ├── completed (boolean), completed_at (timestamptz nullable)
 ├── carried_from (DATE nullable — fecha original si fue arrastrada)
 └── position (integer — orden dentro del día)

push_subscriptions
 ├── user_id, endpoint (UNIQUE junto a user_id), p256dh, auth_key
 └── device_label (ej: "Tablet Samsung")

notifications_log
 ├── user_id, task_id (nullable para summary)
 ├── type (summary | reminder_3d | reminder_1d | reminder_1h)
 └── ref_date — UNIQUE (task_id, type) evita duplicados

user_preferences
 ├── user_id, timezone (default: 'America/Lima')
 ├── summary_time (default: '07:20')
 └── notify_days_before (default: [3, 1])
```

---

## Reglas de negocio críticas

### Días laborables
- **Lunes a Sábado** únicamente. Domingos NO existen en la app.
- `isWorkingDay(date)` → false si `date.getDay() === 0`
- El navegador de fechas (DateNavigator) salta domingos automáticamente.

### Arrastre de tareas (carry-over)
- Al abrir el día D, se buscan tareas incompletas del último día laborable anterior.
- Se insertan en D con `carried_from = D-1` si aún no fueron arrastradas.
- Guard: solo si `targetDate <= today` (nunca arrastrar a días futuros).
- Idempotente: verifica existencia antes de insertar.
- El `daily-summary` Edge Function también hace carry-over como respaldo.

### Auto-detección de tipo en TaskInput
- Keywords al inicio del texto determinan el tipo (case-insensitive, con/sin tilde).
- Si el tipo requiere hora y no hay hora en el texto → prompt inline.
- Tipos que requieren hora: `Audiencia`, `Reunion`, `Plazo`, `Testimonial`, `Indagatoria`, `Declaracion testimonial`, `Declaracion indagatoria`.
- `parseTimeInput()` acepta `09:00`, `900`, `9`, `1130` → normaliza a `HH:MM` formato 24h.

### Edición inline de tareas
- Botón lápiz (✏️) siempre visible → activa modo edición en el ítem.
- En modo edición: input de título + input de hora (solo si la tarea YA tenía hora).
- No se puede agregar hora a tareas que no la tenían.
- Guarda con Enter o ✓. Cancela con Escape o ✗.

### Notificaciones
- **7:20 AM Lima** (Lun-Sáb): resumen del día con todas las tareas pendientes.
- Tareas CON hora: reminder 3 días antes, 1 día antes, 1 hora antes.
- Tareas SIN hora: solo aparecen en el resumen matutino.
- `notifications_log` evita duplicados con UNIQUE constraint `(task_id, type)`.

### Viewport height en tablet
- No usar `100vh` ni `100dvh` como altura fija → causa parpadeo en Samsung.
- Script inline en `<head>` setea `--app-h = window.innerHeight` antes del primer paint.
- Container usa `style={{ height: 'var(--app-h, 100dvh)' }}`.
- `orientationchange` (no `resize`) actualiza `--app-h` al rotar.

---

## Credenciales / configuración activa

- **Supabase project ID**: `dtqpygaovkknsyvgfvie` (región: sa-east-1)
- **Usuario auth**: `agenda-mlp@mlpperu.com` (el login acepta `agenda-mlp` sin @)
- **User UUID**: `e34622ca-a22c-40ff-ac54-29a4a7cea12f`
- **Dominio**: `agenda.mlpperu.com` → CNAME `cname.vercel-dns.com`
