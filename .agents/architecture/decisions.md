# Architecture Decision Records

## ADR-001: PWA en lugar de Tauri

**Fecha**: 2026-02-11 | **Estado**: Aceptado

El abogado necesita acceso desde Windows PC y tablet Samsung. Tauri mobile está en alpha.

**Decisión**: PWA con Next.js. Un solo codebase, Web Push nativo en Android Chrome y Windows Edge/Chrome, instalable sin app store.

✅ Un solo deploy · ✅ Web Push funciona en Android · ✅ Sin app store  
❌ Depende del navegador · ❌ Offline limitado

---

## ADR-002: Supabase como único backend

**Fecha**: 2026-02-11 | **Estado**: Aceptado

Un solo ingeniero, proyecto personal, necesita sync multi-device y auth.

**Decisión**: Supabase maneja todo: auth, PostgreSQL, Edge Functions para crons. Sin servidor Node/Express separado.

✅ Zero infra · ✅ RLS garantiza aislamiento · ✅ Realtime multi-device · ✅ Free tier  
❌ Vendor lock-in

---

## ADR-003: Carry-over lazy (al abrir el día)

**Fecha**: 2026-02-11 | **Estado**: Aceptado

**Decisión**: Cuando se carga el día D, el cliente verifica tareas incompletas del último día laborable y las inserta con `carried_from = D-1`. Solo hacia HOY (no en cadena). Guard: `if (targetDate > today) return`.

✅ Sin cron adicional · ✅ Operación idempotente  
❌ Requiere que el usuario abra la app (mitigado: el `daily-summary` Edge Function también hace carry-over)

---

## ADR-004: Auto-detección de tipo sin modal

**Fecha**: 2026-02-11 | **Estado**: Aceptado

**Decisión**: Keywords al inicio del texto detectan el tipo. Si requiere hora (Audiencia, Reunion, Plazo, Testimonial, Indagatoria, Declaracion testimonial/indagatoria) y no hay hora en el texto → prompt inline debajo del input. Nunca un modal.

✅ Cero fricción · ✅ Flujo idéntico a OneNote  
❌ Puede equivocarse (mitigado con edición inline posterior)

---

## ADR-005: Sin Sundays — días laborables Lun-Sáb

**Fecha**: 2026-02-11 | **Estado**: Aceptado

**Decisión**: Domingos se saltan en el navegador de fechas y en toda lógica de carry-over. `isWorkingDay(date)` retorna false para `date.getDay() === 0`.

✅ UI limpia · ✅ Sin arrastre a domingo · ❌ No configurable (hardcoded)

---

## ADR-006: Service Worker manual en public/sw.js

**Fecha**: 2026-02-12 | **Estado**: Aceptado

`@ducanh2912/next-pwa` usa un plugin webpack que nunca genera `sw.js` cuando Next.js usa Turbopack (que es el default en Next.js 16). El plugin nunca se ejecuta en el build de producción.

**Decisión**: Service Worker estático en `public/sw.js` registrado por `ServiceWorkerRegister.tsx` (Client Component). El SW maneja push notifications y cache básico de assets estáticos.

**Regla crítica en el SW**: El fetch handler debe tener guard same-origin para no interceptar requests cross-origin (supabase.co):
```js
if (!event.request.url.startsWith(self.location.origin)) return
```

✅ Funciona con Turbopack · ✅ Control total del SW  
❌ No hay generación automática de precache de assets Next.js

---

## ADR-007: Script inline síncrono para viewport height

**Fecha**: 2026-02-12 | **Estado**: Aceptado

`100dvh` en Android se calcula antes de que el viewport se inicialice en recargas, causando un layout shift que hace parpadear la barra de navegación de Samsung. `useEffect` corre después del primer paint — demasiado tarde.

**Decisión**: Script inline síncrono en `<head>` que setea `--app-h = window.innerHeight` antes del primer paint. El `useEffect` en `AgendaLayout` queda como respaldo para rotación de pantalla (con `orientationchange`, nunca `resize`).

```html
<script>(function(){try{
  document.documentElement.style.setProperty('--app-h',window.innerHeight+'px')
}catch(e){}})()</script>
```

El container usa: `style={{ height: 'var(--app-h, 100dvh)' }}`

✅ Sin parpadeo en recarga · ✅ Cero costo de runtime  
❌ `dangerouslySetInnerHTML` (necesario, el riesgo es mínimo con contenido estático)
