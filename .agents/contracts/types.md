# Tipos y Schema — agenda-legal

Versión: 1.0.0 · Actualizado: 2026-02-11

---

## Schema SQL (supabase/migrations/20260211_initial.sql)

```sql
-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE task_type AS ENUM (
  'Tarea',
  'Audiencia',
  'Reunion',
  'Llamada',
  'Plazo',
  'Otro'
);

-- =====================================================
-- TABLA: tasks
-- =====================================================
-- Días laborables: Lun-Sáb. Nunca insertar en Domingo.

CREATE TABLE tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,                          -- YYYY-MM-DD, nunca domingo
  title         TEXT        NOT NULL,                          -- texto libre del usuario
  type          task_type   NOT NULL DEFAULT 'Tarea',
  time          TIME        NULL,                              -- NULL = sin hora (solo checklist)
  completed     BOOLEAN     NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ NULL,
  carried_from  DATE        NULL,                              -- fecha original si fue arrastrada
  position      INTEGER     NOT NULL DEFAULT 0,                -- orden dentro del día (0-based)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_user_date_idx ON tasks(user_id, date);
CREATE INDEX tasks_user_date_time_idx ON tasks(user_id, date, time) WHERE time IS NOT NULL;

-- =====================================================
-- TABLA: push_subscriptions
-- =====================================================

CREATE TABLE push_subscriptions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT    NOT NULL,
  p256dh        TEXT    NOT NULL,
  auth_key      TEXT    NOT NULL,
  device_label  TEXT    NULL,   -- ej: "Tablet Samsung", "PC Oficina"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- =====================================================
-- TABLA: user_preferences
-- =====================================================

CREATE TABLE user_preferences (
  user_id              UUID      PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone             TEXT      NOT NULL DEFAULT 'America/Lima',
  summary_time         TIME      NOT NULL DEFAULT '07:20',
  notify_days_before   INTEGER[] NOT NULL DEFAULT '{3,1}',
  notify_hour_before   BOOLEAN   NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: notifications_log
-- =====================================================
-- Evita enviar la misma notificación dos veces

CREATE TABLE notifications_log (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     UUID    NULL REFERENCES tasks(id) ON DELETE CASCADE,  -- NULL para summary
  type        TEXT    NOT NULL,  -- 'summary' | 'reminder_3d' | 'reminder_1d' | 'reminder_1h'
  ref_date    DATE    NOT NULL,  -- fecha de referencia (hoy para summary, fecha del evento para others)
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id, type, ref_date)
);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_tasks"       ON tasks              FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_push"        ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_prefs"       ON user_preferences   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notif_log"   ON notifications_log  FOR ALL USING (auth.uid() = user_id);

-- Edge Functions (service_role) necesitan bypass RLS para los cron jobs
-- Configurar en Supabase Dashboard → Edge Functions → environment: SERVICE_ROLE_KEY
```

---

## Tipos TypeScript (src/lib/types/database.ts)

```typescript
// =====================================================
// ENUMS
// =====================================================

export type TaskType = 'Tarea' | 'Audiencia' | 'Reunion' | 'Llamada' | 'Plazo' | 'Otro'

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Tarea:     '📄 Tarea',
  Audiencia: '⚖️ Audiencia',
  Reunion:   '🤝 Reunión',
  Llamada:   '📞 Llamada',
  Plazo:     '⏰ Plazo',
  Otro:      '📌 Otro',
}

// Tipos que requieren hora (se muestra prompt inline si no hay hora)
export const TIMED_TASK_TYPES: TaskType[] = ['Audiencia', 'Reunion', 'Plazo']

// =====================================================
// TASK
// =====================================================

export interface Task {
  id: string
  user_id: string
  date: string              // DATE como YYYY-MM-DD — nunca domingo
  title: string
  type: TaskType
  time: string | null       // TIME como 'HH:MM' — null si no tiene hora
  completed: boolean
  completed_at: string | null
  carried_from: string | null  // DATE YYYY-MM-DD — fecha original si fue arrastrada
  position: number
  created_at: string
  updated_at: string
}

export type TaskInsert = {
  date: string              // REQUIRED
  title: string             // REQUIRED
  type?: TaskType           // default 'Tarea'
  time?: string | null
  carried_from?: string | null
  position?: number
}

export type TaskUpdate = Partial<{
  title: string
  type: TaskType
  time: string | null
  completed: boolean
  completed_at: string | null
  position: number
  updated_at: string
}>

// =====================================================
// PUSH SUBSCRIPTION
// =====================================================

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  device_label: string | null
  created_at: string
}

// =====================================================
// USER PREFERENCES
// =====================================================

export interface UserPreferences {
  user_id: string
  timezone: string            // default: 'America/Lima'
  summary_time: string        // TIME como 'HH:MM', default: '07:20'
  notify_days_before: number[] // default: [3, 1]
  notify_hour_before: boolean  // default: true
  created_at: string
  updated_at: string
}

// =====================================================
// TASK PARSER (src/lib/utils/task-parser.ts)
// =====================================================

export interface ParsedTask {
  title: string              // texto limpio (sin la hora si la había)
  type: TaskType             // detectado por keyword
  time: string | null        // extraído del texto si estaba presente
  requiresTimePrompt: boolean // true si es Audiencia/Reunion/Plazo sin hora
}

/*
  Reglas de detección (keyword al INICIO del texto, case-insensitive):
  
  "Audiencia *"          → type: Audiencia  | askTime: true
  "Reunion *"            → type: Reunion    | askTime: true
  "Reunión *"            → type: Reunion    | askTime: true
  "Llamar *"             → type: Llamada    | askTime: false
  "Llamada *"            → type: Llamada    | askTime: false
  "Plazo *"              → type: Plazo      | askTime: true
  "Vencimiento *"        → type: Plazo      | askTime: true
  todo lo demás          → type: Tarea      | askTime: false
  
  Extracción de hora del texto:
  "09:00 - Audiencia X"  → time: '09:00', title: 'Audiencia X'
  "09:00 Audiencia X"    → time: '09:00', title: 'Audiencia X'
  "Audiencia X 09:00"    → time: '09:00', title: 'Audiencia X'
  "9:00 Reunión Y"       → time: '09:00', title: 'Reunión Y'
*/

// =====================================================
// CARRY-OVER LOGIC (src/lib/utils/carry-over.ts)
// =====================================================

/*
  Función: getLastWorkingDay(date: Date): Date
  - Retrocede un día, saltando domingos (getDay() === 0)
  
  Función: isWorkingDay(date: Date): boolean
  - true si getDay() !== 0 (no domingo)
  
  Función: shouldCarryOver(targetDate: string): Promise<boolean>
  - Verifica si ya se hizo carry-over para targetDate
  - SELECT COUNT(*) FROM tasks WHERE date = targetDate AND carried_from IS NOT NULL
  - Si count = 0 Y hay tareas incompletas del día anterior → retorna true
  
  Función: performCarryOver(targetDate: string, userId: string): Promise<void>
  - Obtiene tareas incompletas del último día laborable anterior a targetDate
  - Las inserta en targetDate con carried_from = fechaAnterior
  - Solo se ejecuta UNA VEZ por día (verificado con shouldCarryOver)
  
  IMPORTANTE: No hacer carry-over en cadena día por día.
  Si el usuario no abrió la app por una semana, se arrastran las
  tareas incompletas del último día laborable directamente a HOY.
*/
```

---

## VAPID Keys (Web Push)

Generar una vez con: `npx web-push generate-vapid-keys`

Variables de entorno requeridas:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # pública — expuesta al cliente
VAPID_PRIVATE_KEY=             # privada — solo servidor/edge functions
VAPID_SUBJECT=mailto:admin@mlpperu.com
```
