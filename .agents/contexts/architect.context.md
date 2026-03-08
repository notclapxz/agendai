# Architect Context — agenda-legal

Última actualización: 2026-02-12

## Estado del proyecto

**PRODUCCIÓN LIVE** ✅  
URL: `https://agenda.mlpperu.com`  
Todas las fases completadas y en uso activo.

---

## Fases

- [x] Fase 1: Foundation (proyecto + Supabase + PWA base + login)
- [x] Fase 2: Core UI (layout + DateNavigator + DayView + TaskInput + drag & drop)
- [x] Fase 3: Data & Lógica (Supabase CRUD + realtime + carry-over + edición inline)
- [x] Fase 4: Notificaciones (Web Push + Edge Functions + cron jobs)
- [x] Fase 5: Deploy (Vercel + agenda.mlpperu.com + instalación en dispositivos)

---

## Decisiones arquitectónicas

- **ADR-001**: PWA en lugar de Tauri (multi-plataforma, Web Push nativo Android)
- **ADR-002**: Supabase como único backend (sin servidor separado)
- **ADR-003**: Carry-over lazy al abrir el día (no cron de medianoche)
- **ADR-004**: Auto-detección de tipo sin modal (prompt inline debajo del input)
- **ADR-005**: Sin Sundays — Lun-Sáb únicamente
- **ADR-006**: Service Worker manual en `public/sw.js` (next-pwa plugin incompatible con Turbopack)
- **ADR-007**: Script inline síncrono en `<head>` para `--app-h` (elimina parpadeo en Samsung al recargar)

---

## Contexto del cliente

- **Usuario**: Abogado, Lima, Perú (UTC-5 / America/Lima)
- **Dispositivo primario**: Samsung Galaxy Tab S10 FE SM-X520 (1152×720 CSS px landscape)
- **Dispositivo secundario**: Windows PC (Chrome/Edge)
- **Browser soportado**: Chrome, Samsung Internet (Firefox incompatible con Supabase Realtime)
- **App reemplazada**: OneNote

---

## Infraestructura activa

| Servicio | Detalle |
|---|---|
| Vercel | Free tier, deploy automático, dominio custom |
| Supabase | Proyecto `dtqpygaovkknsyvgfvie`, región sa-east-1 |
| Cron daily-summary | `20 12 * * 1-6` → 7:20 AM Lima |
| Cron event-reminder | `*/30 11-23,0-3 * * 1-6` → cada 30 min, 6-22h Lima |
| VAPID keys | Configuradas en Vercel (frontend) y Supabase secrets (edge functions) |

---

## Próximo checkpoint

Verificar mañana (2026-02-13) que la notificación del `daily-summary` llegó a la tablet a las 7:20 AM.
