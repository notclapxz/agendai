'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getDaysInMonthGrid, isSameDay, isToday, toDateString } from '@/lib/utils/dates'
import { useMonthTasks } from '@/hooks/useMonthTasks'
import type { TaskType } from '@/lib/types/database'

// ─── Color map por tipo de tarea ───────────────────────────────────────────────

const TYPE_CHIP_CLASS: Record<TaskType, string> = {
  Tarea:     'bg-gray-100 text-gray-600',
  Audiencia: 'bg-amber-100 text-amber-800',
  Reunion:   'bg-blue-100 text-blue-800',
  Llamada:   'bg-green-100 text-green-800',
  Plazo:     'bg-yellow-100 text-yellow-800',
  Escrito:   'bg-purple-100 text-purple-800',
  Evento:    'bg-pink-100 text-pink-800',
  Documento: 'bg-indigo-100 text-indigo-800',
  Otro:      'bg-gray-100 text-gray-500',
}

// ─── Cabeceras de días — semana empieza lunes ─────────────────────────────────

const WEEKDAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] as const

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarViewProps {
  selectedDate: Date
  userId: string
  onDayClick: (date: Date) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarView({
  selectedDate,
  userId,
  onDayClick,
}: CalendarViewProps) {
  // viewYear / viewMonth son INDEPENDIENTES de selectedDate —
  // navegar el mes NO cambia la fecha seleccionada.
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  const { tasksByDate, loading, error } = useMonthTasks(viewYear, viewMonth, userId)

  const grid = getDaysInMonthGrid(viewYear, viewMonth)

  // ── Navegación de mes ──────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // ── Etiqueta del mes — "marzo 2026" ───────────────────────────────────────

  const monthLabel = format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy', { locale: es })

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2 px-3 py-3">

      {/* ── Navegación de mes ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Mes anterior"
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-base font-semibold capitalize text-gray-700">
          {monthLabel}
        </span>

        <button
          onClick={nextMonth}
          aria-label="Mes siguiente"
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Error (no-fatal — grid sigue renderizando vacío) ───────────────── */}
      {error && (
        <p className="text-center text-xs text-red-500">{error}</p>
      )}

      {/* ── Cabecera de días de la semana ──────────────────────────────────── */}
      <div className="grid grid-cols-7">
        {WEEKDAY_HEADERS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'py-1 text-center text-xs font-medium uppercase tracking-wide',
              // Domingo (índice 6) — atenuado
              i === 6 ? 'text-gray-300' : 'text-gray-400'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* ── Grilla de 42 celdas ────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px">
        {loading
          ? // Estado de carga — skeleton animado
            Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-md bg-gray-100 sm:h-20"
              />
            ))
          : grid.map((day, i) => {
              if (day === null) {
                // Celda de relleno (padding inicio/fin del mes)
                return <div key={`null-${i}`} className="h-16 sm:h-20" />
              }

              const isSunday = day.getDay() === 0
              const todayCell = isToday(day)
              const selectedCell = isSameDay(day, selectedDate)
              const dateKey = toDateString(day)
              const dayTasks = tasksByDate[dateKey] ?? []
              const extraCount = dayTasks.length > 2 ? dayTasks.length - 2 : 0
              const visibleTasks = dayTasks.slice(0, 2)

              return (
                <div
                  key={dateKey}
                  onClick={isSunday ? undefined : () => onDayClick(day)}
                  role={isSunday ? undefined : 'button'}
                  tabIndex={isSunday ? undefined : 0}
                  onKeyDown={
                    isSunday
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onDayClick(day)
                          }
                        }
                  }
                  aria-label={
                    isSunday
                      ? undefined
                      : `${format(day, 'EEEE d MMMM yyyy', { locale: es })}`
                  }
                  aria-pressed={selectedCell && !isSunday ? true : undefined}
                  className={cn(
                    'relative flex h-16 flex-col overflow-hidden rounded-md p-1 text-right transition-colors sm:h-20',
                    // Domingo — sin interacción, apagado
                    isSunday && 'cursor-default opacity-40',
                    // Día laborable — interactivo (hover solo en días que NO son hoy ni seleccionados)
                    !isSunday && !todayCell && !selectedCell && 'cursor-pointer hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    // Hoy — ring azul, fondo muy suave, sin hover que tape
                    todayCell && !selectedCell && 'cursor-pointer ring-2 ring-blue-500 focus-visible:outline-none',
                    // Seleccionado — ring azul fuerte, fondo neutro (no sólido) para que los chips se vean
                    selectedCell && !isSunday && 'cursor-pointer ring-2 ring-blue-600 bg-blue-50 focus-visible:outline-none',
                  )}
                >
                  {/* Número del día */}
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold leading-none',
                      isSunday && 'text-gray-400',
                      !isSunday && !todayCell && !selectedCell && 'text-gray-700',
                      todayCell && !selectedCell && 'text-blue-600',
                      selectedCell && !todayCell && 'text-blue-700',
                      selectedCell && todayCell && 'text-blue-600',
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Chips de tareas — solo días laborables */}
                  {!isSunday && (
                    <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-px overflow-hidden">
                      {visibleTasks.map((task) => (
                        <span
                          key={task.id}
                          className={cn(
                            'truncate rounded px-1 text-[10px] font-medium leading-tight',
                            TYPE_CHIP_CLASS[task.type]
                          )}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                      ))}

                      {/* "+N" si hay más de 2 tareas */}
                      {extraCount > 0 && (
                        <span
                          className={cn(
                            'truncate rounded px-1 text-[10px] font-medium leading-tight',
                            'bg-gray-100 text-gray-500'
                          )}
                        >
                          +{extraCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
      </div>
    </div>
  )
}
