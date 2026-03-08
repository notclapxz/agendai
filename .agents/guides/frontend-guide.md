# Frontend Engineer Guide — agenda-legal

## Tu workspace

📁 `/Users/sebastian/Desktop/agenda-legal/` — trabajá SOLO aquí

---

## Antes de empezar

1. Leer `plans/00-master.md` → entender las 5 fases
2. Leer `contracts/types.md` → todos los tipos y el schema SQL
3. Leer `architecture/overview.md` → visión del sistema completo
4. Leer el plan de la fase actual → pasos concretos a ejecutar

---

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx          ← PWA metadata, manifest link, fuente
│   ├── page.tsx            ← redirect a /agenda
│   ├── login/page.tsx      ← pantalla de login
│   ├── agenda/page.tsx     ← vista principal (Server Component con auth guard)
│   └── api/push/           ← subscribe + unsubscribe routes
├── components/
│   ├── agenda/
│   │   ├── AgendaLayout.tsx    ← Client Component, estado de fecha
│   │   ├── DateNavigator.tsx   ← panel izquierdo
│   │   ├── DayView.tsx         ← panel derecho
│   │   ├── TaskItem.tsx        ← item individual
│   │   ├── TaskInput.tsx       ← input con auto-detección
│   │   └── CarriedSection.tsx  ← sección tareas arrastradas
│   └── ui/                 ← shadcn components
├── hooks/
│   ├── useTasks.ts         ← CRUD + realtime + carry-over
│   └── usePush.ts          ← Web Push subscription management
└── lib/
    ├── supabase/
    │   ├── client.ts       ← browser (no await)
    │   └── server.ts       ← SSR (await createClient())
    ├── types/database.ts   ← copiar de contracts/types.md
    └── utils/
        ├── dates.ts        ← isWorkingDay, getLastWorkingDay, etc.
        ├── task-parser.ts  ← parseTask: detecta tipo + hora del texto libre
        └── carry-over.ts   ← performCarryOverIfNeeded
```

---

## Convenciones de código

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Componentes | PascalCase | `DateNavigator.tsx` |
| Carpetas | kebab-case | `core-ui/`, `agenda/` |
| Hooks | useCamelCase | `useTasks.ts` |
| Utils | camelCase | `dates.ts`, `task-parser.ts` |
| Types | PascalCase | `Task`, `TaskInsert`, `ParsedTask` |
| Constants | UPPER_SNAKE_CASE | `TIMED_TASK_TYPES`, `TASK_TYPE_LABELS` |

---

## Import order (estricto)

```typescript
'use client'                                      // 1. Directiva (SOLO si necesaria)

import { useState, useEffect } from 'react'       // 2. React
import { useRouter } from 'next/navigation'       // 3. Next.js
import { format, isToday } from 'date-fns'        // 4. Third-party (alfabético)
import { es } from 'date-fns/locale'
import { Check, ChevronLeft } from 'lucide-react' // 5. Iconos
import { createClient } from '@/lib/supabase/client'  // 6. Supabase
import { useTasks } from '@/hooks/useTasks'        // 7. Hooks propios
import TaskItem from '@/components/agenda/TaskItem' // 8. Componentes (@/ alias)
import { isWorkingDay } from '@/lib/utils/dates'   // 9. Utils
import type { Task, TaskType } from '@/lib/types/database' // 10. Types (siempre `type`)
```

---

## Reglas TypeScript

- **NO `any`** — usar tipos de `@/lib/types/database` o `unknown`
- **`import type`** para imports de tipos
- **Null safety**: `data?.field ?? null` (nullable) / `data?.field ?? ''` (not null)
- **`catch (err: unknown)`** → `err instanceof Error ? err.message : 'Error desconocido'`
- **Un estado objeto** para formularios: `useState({ campo1: '', campo2: '' })`

---

## Reglas de negocio — nunca romper estas

```typescript
// ❌ NUNCA procesar o mostrar domingos
// ✅ Siempre usar isWorkingDay() antes de trabajar con fechas

// ❌ NUNCA insert de task sin verificar que la fecha no es domingo
// ✅ date.getDay() !== 0

// ❌ NUNCA carry-over a domingo
// ✅ getLastWorkingDay() salta domingos automáticamente

// ❌ NUNCA notificar una task SIN hora individualmente
// ✅ Solo tasks con time !== null tienen reminder_3d/1d/1h

// ❌ NUNCA .select('*')
// ✅ .select('id, user_id, date, title, type, time, completed, position, carried_from')
```

---

## Error handling

```typescript
import { formatError } from '@/lib/utils/errors'

try { ... }
catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Error desconocido'
  setError(msg)
  console.error('[ComponentName]', err)
}
```

---

## Comandos

```bash
# Desde /Users/sebastian/Desktop/agenda-legal/
npm run dev              # Turbopack dev server → http://localhost:3000
npm run build            # DEBE pasar antes de declarar done
npm run lint             # 0 errores requeridos

# E2E (configurar en Fase 1 si se quiere)
npx playwright test
```

---

## Actualizar tu contexto

Después de cada tarea completada, actualizar `contexts/frontend.context.md` con:
- Qué terminaste
- Qué decisiones técnicas tomaste (librería, patrón, etc.)
- Si hay algún bloqueo
