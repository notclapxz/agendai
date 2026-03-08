# Plan Maestro — agenda-legal

Proyecto: Agenda personal para abogado (Lima, Perú)  
Creado: 2026-02-11  
Ingeniero: Sebastian (frontend + Supabase)

---

## Resumen ejecutivo

PWA instalable (Next.js 15 + Supabase) que reemplaza OneNote como agenda diaria del abogado. Un solo usuario, multi-dispositivo (tablet Samsung + PC Windows), con notificaciones Web Push inteligentes.

---

## Fases

### Fase 1 · Foundation (Días 1-2)
**Dependencias**: Ninguna  
**Plan**: `plans/01-foundation.md`

- [ ] Crear proyecto Next.js 15 en `/Users/sebastian/Desktop/agenda-legal`
- [ ] Configurar TypeScript strict, Tailwind 4, shadcn/ui
- [ ] Crear proyecto Supabase y aplicar migration inicial
- [ ] Configurar PWA (manifest + service worker base)
- [ ] Login screen funcional (email/password)
- [ ] Variables de entorno configuradas
- [ ] Deploy inicial en Vercel (URL temporal)

**Definición de done**: `npm run build` pasa, login funciona, app instalable en Chrome.

---

### Fase 2 · UI Core — La agenda (Días 3-5)
**Dependencias**: Fase 1 completa  
**Plan**: `plans/02-core-ui.md`

- [ ] Layout 2 paneles (landscape-first para tablet)
- [ ] Panel izquierdo: DateNavigator (lista de fechas, sin domingos)
- [ ] Panel derecho: DayView (vista del día seleccionado)
- [ ] Abre en HOY por defecto, navegable a cualquier fecha
- [ ] TaskItem component (checkbox, tipo badge, hora si tiene)
- [ ] TaskInput inteligente (auto-detección tipo + hora)
- [ ] Prompt inline para hora (cuando tipo requiere hora y no se escribió)
- [ ] Diseño responsive: tablet landscape (primary), PC, mobile

**Definición de done**: El abogado puede crear, ver y tachar tareas en cualquier día sin tocar el mouse más de lo necesario.

---

### Fase 3 · Data & Lógica (Días 5-6)
**Dependencias**: Fase 2 (UI lista sin datos reales)  
**Plan**: `plans/03-data-tasks.md`

- [ ] CRUD de tareas con Supabase (create, read, update, delete)
- [ ] Realtime sync (cambios visibles en otro dispositivo sin recargar)
- [ ] Carry-over lazy: tareas incompletas arrastradas al día siguiente laborable
- [ ] Reordenamiento de tareas (drag & drop o flechas arriba/abajo)
- [ ] Marcar completado con animación de tachado
- [ ] Filtro visual: tareas arrastradas agrupadas al final con indicador

**Definición de done**: Los datos persisten en Supabase, sincroniza entre tablet y PC, el carry-over funciona correctamente sin arrastrar a domingos.

---

### Fase 4 · Notificaciones Web Push (Días 7-8)
**Dependencias**: Fase 3 completa  
**Plan**: `plans/04-notifications.md`

- [ ] Generar VAPID keys
- [ ] Service worker configurado para recibir push
- [ ] Botón "Activar notificaciones" en settings
- [ ] API route para guardar/eliminar subscriptions en Supabase
- [ ] Edge Function: daily-summary (cron 7:20 AM Lima = 12:20 UTC, Lun-Sáb)
- [ ] Edge Function: event-reminder (cron cada 30 min, Lun-Sáb)
- [ ] notifications_log evita duplicados
- [ ] Test real en tablet Samsung + PC Windows

**Definición de done**: El abogado recibe notificación a las 7:20 AM con su resumen del día, y alertas 3 días antes / día anterior / 1 hora antes de eventos con hora.

---

### Fase 5 · Deploy & Dominio (Día 9)
**Dependencias**: Fase 4 completa  
**Plan**: `plans/05-deploy.md`

- [ ] Vercel configurado con variables de producción
- [ ] CNAME en GoDaddy: `agenda` → `cname.vercel-dns.com`
- [ ] Dominio `agenda.mlpperu.com` activo en Vercel
- [ ] HTTPS funcionando (Vercel lo maneja automáticamente)
- [ ] Test de instalación PWA en tablet Samsung
- [ ] Test de instalación PWA en PC Windows (Edge)
- [ ] Test de notificaciones push en producción

**Definición de done**: El abogado instala la app en su tablet desde `agenda.mlpperu.com` y funciona exactamente como una app nativa.

---

## Camino crítico

```
Foundation → Core UI → Data/Lógica → Notificaciones → Deploy
    1-2         3-5         5-6            7-8            9
```

## Stack final

| | |
|---|---|
| Framework | Next.js 15 App Router |
| UI | React 19 + TypeScript strict + Tailwind 4 + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| Push | Web Push API + VAPID |
| PWA | next-pwa (service worker + manifest) |
| Deploy | Vercel |
| Dominio | agenda.mlpperu.com (GoDaddy CNAME → Vercel) |

## Estructura del proyecto

```
agenda-legal/
├── .agents/             ← documentación del proyecto (arquitecto)
├── src/
│   ├── app/
│   │   ├── layout.tsx       ← PWA metadata, manifest link
│   │   ├── page.tsx         ← redirect a /agenda
│   │   ├── login/page.tsx
│   │   ├── agenda/page.tsx  ← vista principal
│   │   └── api/push/        ← subscribe / unsubscribe routes
│   ├── components/
│   │   ├── agenda/          ← AgendaLayout, DateNavigator, DayView,
│   │   │                       TaskItem, TaskInput, CarriedSection
│   │   └── ui/              ← shadcn components
│   ├── hooks/
│   │   ├── useTasks.ts
│   │   └── usePush.ts
│   └── lib/
│       ├── supabase/        ← client.ts, server.ts
│       ├── types/database.ts
│       └── utils/
│           ├── dates.ts        ← isWorkingDay, getLastWorkingDay, skipSundays
│           ├── task-parser.ts  ← parseTask: detecta tipo + hora del texto
│           └── carry-over.ts   ← lógica de arrastre lazy
├── supabase/
│   ├── migrations/20260211_initial.sql
│   └── functions/
│       ├── daily-summary/index.ts
│       └── event-reminder/index.ts
├── public/
│   ├── manifest.json
│   └── icons/             ← 192x192, 512x512 (logo MLP)
├── AGENTS.md
├── next.config.ts
└── package.json
```
