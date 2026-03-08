import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Días laborables: Lun–Sáb. Los domingos NO EXISTEN en esta app. */
export function isWorkingDay(date: Date): boolean {
  return date.getDay() !== 0
}

/** Retrocede un día saltando domingos. */
export function getLastWorkingDay(date: Date): Date {
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  if (prev.getDay() === 0) prev.setDate(prev.getDate() - 1)
  return prev
}

/** Avanza un día saltando domingos. */
export function getNextWorkingDay(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  if (next.getDay() === 0) next.setDate(next.getDate() + 1)
  return next
}

/** Todos los días Lun–Sáb de un mes dado. month es 0-indexed. */
export function getWorkingDaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const cursor = new Date(year, month, 1)
  while (cursor.getMonth() === month) {
    if (isWorkingDay(cursor)) days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Compara solo año/mes/día, ignora hora. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** true si la fecha es hoy. */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/** Date → "YYYY-MM-DD" para Supabase. Usa hora LOCAL (no UTC) para evitar
 *  off-by-one en zonas UTC- (ej: Lima UTC-5 después de las 7 PM). */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" → Date (mediodía local para evitar off-by-one de timezone). */
export function fromDateString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

/** Hoy como día laborable (si hoy es domingo, retorna el sábado). */
export function getTodayWorkingDay(): Date {
  const today = new Date()
  return isWorkingDay(today) ? today : getLastWorkingDay(today)
}

/**
 * "Miércoles 11 · Febrero 2026"
 * Usa date-fns locale es.
 */
export function formatDateHeader(date: Date): string {
  const raw = format(date, "EEEE d '·' MMMM yyyy", { locale: es })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * { num: '11', label: 'Mié' } — para ítems del DateNavigator.
 */
export function formatShortDay(date: Date): { num: string; label: string } {
  return {
    num: format(date, 'd'),
    label: format(date, 'EEE', { locale: es }),
  }
}
