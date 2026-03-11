import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Todos los días son válidos — sin restricción por día de la semana. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isWorkingDay(_date: Date): boolean {
  return true
}

/** Retrocede exactamente un día. */
export function getLastWorkingDay(date: Date): Date {
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  return prev
}

/** Avanza exactamente un día. */
export function getNextWorkingDay(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  return next
}

/** Todos los días del mes. month es 0-indexed. */
export function getWorkingDaysOfMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const cursor = new Date(year, month, 1)
  while (cursor.getMonth() === month) {
    days.push(new Date(cursor))
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

/** Hoy — sin restricción de día de la semana. */
export function getTodayWorkingDay(): Date {
  return new Date()
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

/**
 * Retorna exactamente 42 celdas (6 semanas × 7 días) para la grilla del mes.
 * La semana empieza en LUNES (índice 0 = lunes ... 6 = domingo).
 * Las celdas de relleno al inicio y al final son null.
 * month es 0-indexed (convención JS: 0 = enero, 11 = diciembre).
 */
export function getDaysInMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // getDay() → 0=domingo ... 6=sábado
  // Convertir a Monday-first: lunes=0 ... domingo=6
  const firstDow = (firstDay.getDay() + 6) % 7
  const lastDow = (lastDay.getDay() + 6) % 7

  const grid: (Date | null)[] = []

  // Padding inicio
  for (let i = 0; i < firstDow; i++) {
    grid.push(null)
  }

  // Días del mes
  const cursor = new Date(year, month, 1)
  while (cursor.getMonth() === month) {
    grid.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  // Padding fin: completar hasta 42 celdas
  const trailingNulls = lastDow === 6 ? 0 : 6 - lastDow
  for (let i = 0; i < trailingNulls; i++) {
    grid.push(null)
  }

  // Si quedamos en 35, agregar una semana más para llegar a 42
  while (grid.length < 42) {
    grid.push(null)
  }

  return grid
}

export function formatCarriedFrom(dateStr: string): string {
  const date = fromDateString(dateStr)
  const yesterday = getLastWorkingDay(getTodayWorkingDay())
  if (isSameDay(date, yesterday)) return 'de ayer'
  const label = format(date, 'EEEE d/MM', { locale: es })
  return `del ${label}`
}
