# AGENTS.md — agenda-legal

**Proyecto**: Agenda personal para abogado — PWA multi-dispositivo  
**Stack**: Next.js 16.1.6 · React 19 · TypeScript strict · Supabase (`@supabase/ssr`) · Tailwind 4 · shadcn/ui · Web Push  
**Working directory**: `/Users/sebastian/Desktop/agenda-legal/` — TODOS los comandos desde aquí  
**Path alias**: `@/` → `src/` (configurado en `tsconfig.json`)  
**Docs completos**: `.agents/` — leer ANTES de empezar

---

## Comandos

```bash
npm run dev              # Turbopack → http://localhost:3000
npm run build            # Producción — DEBE pasar antes de declarar done
npm run lint             # ESLint — 0 errores, 0 warnings requeridos
npm run start            # Servidor producción local

# E2E (Playwright)
npx playwright test                              # todos los tests
npx playwright test tests/login.spec.ts          # un archivo
npx playwright test -g "nombre del test"         # un test específico
npx playwright test --headed                     # con browser visible
npx playwright show-report                       # ver reporte HTML

# Deploy
npx vercel               # deploy a Vercel (primera vez)
npx vercel --prod        # deploy a producción

# Supabase Edge Functions
npx supabase functions deploy daily-summary
npx supabase functions deploy event-reminder
```

---

## Estructura del proyecto

```
src/
├── proxy.ts                    # Proxy SSR — session refresh + auth redirect (Next.js 16)
├── app/
│   ├── layout.tsx              # Root layout (PWA meta, manifest)
│   ├── page.tsx                # → redirect /agenda
│   ├── login/page.tsx          # Login (email + password)
│   ├── agenda/page.tsx         # Vista principal (Server Component, auth guard)
│   └── api/
│       ├── push/               # subscribe/route.ts · unsubscribe/route.ts
│       └── voice/route.ts      # POST — gpt-4o-transcribe + gpt-5 (json_schema) → tareas estructuradas
├── components/
│   ├── agenda/                 # AgendaLayout, DateNavigator, DayView,
│   │                           # TaskItem, TaskInput, CarriedSection
│   └── ui/                     # shadcn/ui components
├── hooks/
│   ├── useTasks.ts             # CRUD + realtime + carry-over
│   └── usePush.ts              # Web Push subscription
└── lib/
    ├── supabase/client.ts      # browser (sin await)
    ├── supabase/server.ts      # SSR (await createClient())
    ├── types/database.ts       # FUENTE DE VERDAD — copiar de .agents/contracts/types.md
    └── utils/
        ├── dates.ts            # isWorkingDay, getLastWorkingDay, skipSundays
        ├── task-parser.ts      # parseTask: detecta tipo + hora del texto libre
        └── carry-over.ts       # performCarryOverIfNeeded (lazy, al abrir el día)
supabase/
├── migrations/20260211_initial.sql
└── functions/
    ├── daily-summary/index.ts  # cron 12:20 UTC (7:20 AM Lima) Lun-Sáb
    └── event-reminder/index.ts # cron cada 30 min (6-22h) Lun-Sáb
```

---

## Naming conventions

| Artefacto   | Patrón          | Ejemplo                        |
|-------------|-----------------|--------------------------------|
| Componentes | PascalCase      | `DateNavigator.tsx`            |
| Hooks       | useCamelCase    | `useTasks.ts`                  |
| Utils       | camelCase       | `task-parser.ts`, `dates.ts`   |
| Types       | PascalCase      | `Task`, `TaskInsert`           |
| Constants   | UPPER_SNAKE     | `TIMED_TASK_TYPES`             |
| Carpetas    | kebab-case      | `agenda/`, `core-ui/`          |

---

## Import order (estricto)

```typescript
'use client'                                          // 1. Directiva — SOLO cuando necesaria

import { useState, useEffect } from 'react'           // 2. React
import { useRouter } from 'next/navigation'           // 3. Next.js
import { format } from 'date-fns'                     // 4. Third-party (alfabético)
import { Check, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'  // 5. Supabase (client OR server)
import { useTasks } from '@/hooks/useTasks'            // 6. Hooks propios
import TaskItem from '@/components/agenda/TaskItem'   // 7. Componentes (@/ alias)
import { isWorkingDay } from '@/lib/utils/dates'      // 8. Utils
import type { Task, TaskType } from '@/lib/types/database' // 9. Types LAST — siempre `type`
```

---

## TypeScript

- **NO `any`** — usar tipos de `@/lib/types/database` o `unknown`
- **`import type`** para todos los imports de tipos
- **Null safety**: `data?.field ?? null` (nullable) / `data?.field ?? ''` (NOT NULL en DB)
- **`catch (err: unknown)`** — nunca `catch (err: any)`
- **Un estado objeto** para forms: `useState({ campo1: '', campo2: '' })`
- `tsconfig.json` debe tener `"strict": true` y `"noUncheckedIndexedAccess": true`

---

## Component patterns

### Server Component (páginas con auth guard — default)
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AgendaPage() {
  const supabase = await createClient()           // await obligatorio en server
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AgendaLayout userId={user.id} />
}
```

### Client Component (estado / efectos / handlers)
```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'  // sin await
import type { Task } from '@/lib/types/database'

export default function AgendaLayout({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState(new Date())  // HOY por defecto
  const supabase = createClient()
}
```

---

## Error handling

```typescript
try { ... }
catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Error desconocido'
  setError(msg)
  console.error('[ComponentName]', err)    // console.error SOLO en catch
}
```

---

## Reglas de negocio — NUNCA romper

```typescript
// Domingos NO EXISTEN. Verificar siempre antes de trabajar con fechas:
isWorkingDay(date)          // false si domingo (date.getDay() === 0)
getLastWorkingDay(date)     // salta domingos — usar para carry-over

// Carry-over: SOLO del último día laborable a HOY (no en cadena)
// Idempotente: verificar con shouldCarryOver() antes de ejecutar

// Queries: NUNCA .select('*')
// ✅ .select('id, date, title, type, time, completed, position, carried_from')

// Notificaciones: tasks SIN hora → solo en resumen matutino
// tasks CON hora → reminder_3d, reminder_1d, reminder_1h
// notifications_log evita duplicados (UNIQUE constraint)
```

---

## Enums DB (CASE-SENSITIVE)

```typescript
type TaskType = 'Tarea' | 'Audiencia' | 'Reunion' | 'Llamada' | 'Plazo' | 'Escrito' | 'Otro'
// Tipos que requieren hora si no se especifica en el texto:
const TIMED_TASK_TYPES: TaskType[] = ['Audiencia', 'Reunion', 'Plazo']
// Timezone: 'America/Lima' (UTC-5, sin DST)
```

---

## Task Parser — detección de texto libre

```
"Audiencia Gutierrez"     → type: Audiencia, requiresTimePrompt: true
"Reunion Carlos Moreno"   → type: Reunion,   requiresTimePrompt: true
"09:00 Audiencia Roo"     → type: Audiencia, time: '09:00'
"Llamar a C. Aguirre"     → type: Llamada,   requiresTimePrompt: false
"Preparar denuncia X"     → type: Tarea,     requiresTimePrompt: false
```

El prompt de hora es **inline** (debajo del input), **nunca un modal**.  
`[Sin hora]` permite confirmar sin hora obligatoria.

---

## Feature de Voz (AI)

El sistema permite crear tareas dictando por voz. Pipeline: grabación → transcripción → extracción → preview → confirm.

**Archivos involucrados**:
- `src/components/agenda/TaskInput.tsx` — UI de grabación (botón micrófono, estados de grabación/preview)
- `src/app/api/voice/route.ts` — Endpoint POST, auth guard, pipeline AI
- `src/hooks/useTasks.ts` — recibe las tareas confirmadas via `createTask()`

**Endpoint**: `POST /api/voice`
- Auth: requerida (Supabase session)
- Input: `multipart/form-data` con campos:
  - `audio` — Blob en formato `audio/webm` (⚠️ no soportado en Safari/iOS)
  - `today` — fecha actual `YYYY-MM-DD`
  - `selectedDate` — fecha seleccionada en la UI `YYYY-MM-DD`
- Output: `{ tasks: VoiceTask[], transcript: string }`

**Pipeline AI**:
1. gpt-4o-transcribe → transcripción del audio en español
2. gpt-5 (`temperature: 0`, `json_schema`) → extrae array de tareas estructuradas

**Tipo VoiceTask**:
```typescript
interface VoiceTask {
  title: string
  type: TaskType
  time: string | null    // 'HH:MM' o null
  date: string | null    // 'YYYY-MM-DD' o null (null = selectedDate)
}
```

**Env var requerida**: `OPENAI_API_KEY`
- Sin esta variable el endpoint retorna error 500
- Agregar a `.env.local` y a las variables de entorno en Vercel

**Reglas de negocio del modelo**:
- Domingos NO existen — el modelo conoce esta regla vía system prompt
- `date: null` significa "usar la fecha seleccionada en la UI"
- Tipos válidos: `Tarea | Audiencia | Reunion | Llamada | Plazo | Escrito | Otro`
- `TIMED_TASK_TYPES` aplica igual que en entrada de texto: `Audiencia | Reunion | Plazo`

**Limitación conocida**: `audio/webm` no es soportado por Safari/iOS — la grabación de voz no funciona en iPhone/iPad. Fix pendiente (MediaRecorder fallback a `audio/mp4`).

---

## Pre-commit checklist

- [ ] `npm run lint` → 0 errores, 0 warnings
- [ ] `npm run build` → compilación exitosa
- [ ] Ninguna query usa `.select('*')`
- [ ] Ningún Domingo llega a la DB o a la UI
- [ ] Carry-over verificado como idempotente
- [ ] Tasks sin hora NO tienen notificaciones individuales
- [ ] `'use client'` SOLO donde hay estado/efectos/handlers
- [ ] `import type` para todos los tipos
- [ ] No quedan `console.log` (usar `console.error` solo en catch)
- [ ] `router.refresh()` después de mutaciones en Client Components
- [ ] `src/proxy.ts` existe y exporta `proxy` (NO debe existir `src/middleware.ts`)

---

**Dominio prod**: `https://agenda.mlpperu.com`  
**Tipos fuente de verdad**: `.agents/contracts/types.md` → copiar a `src/lib/types/database.ts`  
**Version**: 1.0.0 · **Creado**: Feb 2026
