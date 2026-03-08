# agenda-legal · Agente de Navegación Central

**Proyecto**: Agenda personal para abogado — PWA multi-dispositivo  
**Arquitecto**: Sebastian (Feb 2026)  
**Estado actual**: Fase 1 · Foundation

---

## Índice rápido

| Qué buscás | Dónde está |
|------------|-----------|
| ¿Qué hay que hacer ahora? | `plans/00-master.md` |
| Setup del proyecto | `plans/01-foundation.md` |
| UI y componentes | `plans/02-core-ui.md` |
| Base de datos y lógica de tareas | `plans/03-data-tasks.md` |
| Notificaciones Web Push | `plans/04-notifications.md` |
| Deploy y dominio | `plans/05-deploy.md` |
| Tipos TypeScript + schema SQL | `contracts/types.md` |
| Decisiones de arquitectura (ADRs) | `architecture/decisions.md` |
| Visión general del sistema | `architecture/overview.md` |
| Estado actual del frontend | `contexts/frontend.context.md` |

---

## Reglas del proyecto

1. **Un solo ingeniero** (frontend + Supabase). No hay backend separado.
2. **Supabase = backend**. Edge Functions para cron jobs de notificaciones.
3. **PWA primero** — todo se diseña para tablet landscape, luego se adapta.
4. **Simple para el usuario, complejo debajo** — la complejidad es nuestra, no de él.
5. Leer `plans/00-master.md` antes de cualquier cosa.
