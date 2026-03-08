import { TIMED_TASK_TYPES } from '@/lib/types/database'
import type { ParsedTask, TaskType } from '@/lib/types/database'

// Regex para extraer hora del texto: "09:00" o "9:00"
const TIME_REGEX = /\b(\d{1,2}):(\d{2})\b/

// Mapa keyword → TaskType (keyword al INICIO del texto, case-insensitive)
// Los patrones multi-palabra van ANTES que los de una sola palabra
const TYPE_KEYWORDS: Array<{ pattern: RegExp; type: TaskType }> = [
  { pattern: /^declaraci[oó]n\s+testimonial\b/i, type: 'Audiencia' },
  { pattern: /^declaraci[oó]n\s+indagatoria\b/i, type: 'Audiencia' },
  { pattern: /^audiencia\b/i,                    type: 'Audiencia' },
  { pattern: /^testimonial\b/i,                  type: 'Audiencia' },
  { pattern: /^indagatoria\b/i,                  type: 'Audiencia' },
  { pattern: /^reuni[oó]n?\b/i,                  type: 'Reunion'   },
  { pattern: /^llamar\b/i,                       type: 'Llamada'   },
  { pattern: /^llamada\b/i,                      type: 'Llamada'   },
  { pattern: /^plazo\b/i,                        type: 'Plazo'     },
  { pattern: /^vencimiento\b/i,                  type: 'Plazo'     },
  { pattern: /^escrito\b/i,                      type: 'Escrito'   },
]

/**
 * Detecta tipo, hora y título a partir de texto libre.
 *
 * Ejemplos:
 *   "Audiencia Gutierrez"      → { type: 'Audiencia', time: null, requiresTimePrompt: true }
 *   "09:00 Audiencia Roo"      → { type: 'Audiencia', time: '09:00', requiresTimePrompt: false }
 *   "Llamar a C. Aguirre"      → { type: 'Llamada',   time: null, requiresTimePrompt: false }
 *   "Preparar denuncia"        → { type: 'Tarea',     time: null, requiresTimePrompt: false }
 */
export function parseTask(raw: string): ParsedTask {
  let text = raw.trim()

  // 1. Extraer hora si existe en el texto
  let time: string | null = null
  const timeMatch = TIME_REGEX.exec(text)
  if (timeMatch?.[1] !== undefined && timeMatch?.[2] !== undefined) {
    const hours = timeMatch[1].padStart(2, '0')
    const minutes = timeMatch[2]
    time = `${hours}:${minutes}`
    // Remover la hora del título (con separador opcional " - " o " ")
    text = text.replace(/\s*[-–]?\s*\d{1,2}:\d{2}\s*[-–]?\s*/g, ' ').trim()
  }

  // 2. Detectar tipo por keyword al inicio
  let type: TaskType = 'Tarea'
  for (const { pattern, type: detected } of TYPE_KEYWORDS) {
    if (pattern.test(text)) {
      type = detected
      break
    }
  }

  // 3. requiresTimePrompt: solo si el tipo necesita hora y no se encontró
  const requiresTimePrompt = TIMED_TASK_TYPES.includes(type) && time === null

  return { title: text, type, time, requiresTimePrompt }
}

/**
 * Normaliza hora ingresada por el usuario → "HH:MM" o null si inválido.
 *
 * Acepta: "9:00" "09:00" "900" "1130" "11" "9" etc.
 * Siempre devuelve formato 24h.
 */
export function parseTimeInput(raw: string): string | null {
  const clean = raw.trim().replace(/[^0-9:]/g, '')
  if (!clean) return null

  // Formato HH:MM con dos puntos
  const colonMatch = /^(\d{1,2}):(\d{2})$/.exec(clean)
  if (colonMatch?.[1] !== undefined && colonMatch?.[2] !== undefined) {
    const h = parseInt(colonMatch[1], 10)
    const m = parseInt(colonMatch[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // Solo dígitos
  const nums = clean.replace(':', '')
  if (nums.length === 1 || nums.length === 2) {
    const h = parseInt(nums, 10)
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`
  }
  if (nums.length === 3 || nums.length === 4) {
    const h = parseInt(nums.slice(0, nums.length - 2), 10)
    const m = parseInt(nums.slice(-2), 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  return null
}
