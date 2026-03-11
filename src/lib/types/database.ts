// =====================================================
// ENUMS
// =====================================================

export type TaskType = 'Tarea' | 'Audiencia' | 'Reunion' | 'Llamada' | 'Plazo' | 'Escrito' | 'Otro'

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  Tarea:     '📄 Tarea',
  Audiencia: '⚖️ Audiencia',
  Reunion:   '🤝 Reunión',
  Llamada:   '📞 Llamada',
  Plazo:     '⏰ Plazo',
  Escrito:   '📝 Escrito',
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
// MONTH VIEW
// =====================================================

export interface MonthTask {
  id: string
  date: string        // YYYY-MM-DD
  title: string
  type: TaskType
  completed: boolean
}

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

// =====================================================
// UI TYPES — compartidos entre componentes
// =====================================================

export interface TaskSubmitData {
  title: string
  type: TaskType
  time: string | null
  /** undefined → el receptor (DayView) usa su fecha seleccionada */
  date?: string
}

// =====================================================
// VOICE API — /api/voice (gpt-4o-transcribe + gpt-5)
// =====================================================

export interface VoiceTask {
  title: string
  type: TaskType           // CASE-SENSITIVE — debe matchear TaskType exactamente
  time: string | null      // 'HH:MM' o null
  date: string | null      // 'YYYY-MM-DD' o null (null = usar selectedDate en UI)
}

export interface VoiceApiResponse {
  tasks: VoiceTask[]
  transcript: string
}
