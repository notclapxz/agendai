'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  getWorkingDaysOfMonth,
  isSameDay,
  isToday,
  formatShortDay,
  getTodayWorkingDay,
  toDateString,
} from '@/lib/utils/dates'

interface DateNavigatorProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export default function DateNavigator({
  selectedDate,
  onSelectDate,
}: DateNavigatorProps) {
  const today = getTodayWorkingDay()
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  // Sincronizar mes visible cuando selectedDate cambia externamente
  // (ej: click en el CalendarView desde otro mes)
  useEffect(() => {
    setViewYear(selectedDate.getFullYear())
    setViewMonth(selectedDate.getMonth())
  }, [selectedDate])

  const workingDays = getWorkingDaysOfMonth(viewYear, viewMonth)

  // Ref al día seleccionado para scroll automático
  const selectedRef = useRef<HTMLButtonElement>(null)
  // Scroll automático al día seleccionado cuando cambia el mes visible
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [viewMonth, viewYear])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function goToToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    onSelectDate(today)
  }

  // "Ir a hoy" visible siempre que el día seleccionado no sea hoy
  const selectedIsToday = isToday(selectedDate)

  return (
    <div className="flex h-full flex-col">
      {/* Header de mes */}
      <div className="shrink-0 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            aria-label="Mes anterior"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-base font-semibold capitalize text-gray-700">
            {format(new Date(viewYear, viewMonth), 'MMMM yyyy', { locale: es })}
          </span>

          <button
            onClick={nextMonth}
            aria-label="Mes siguiente"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Botón "Ir a hoy" — visible siempre que el día seleccionado no sea hoy */}
        {!selectedIsToday && (
          <button
            onClick={goToToday}
            className="mt-2 w-full rounded-md bg-blue-50 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100"
          >
            Ir a hoy
          </button>
        )}
      </div>

      {/* Lista de días */}
      <div className="flex-1 overflow-y-auto py-1">
        {workingDays.map((day) => {
          const selected = isSameDay(day, selectedDate)
          const todayDay = isToday(day)
          const { num, label } = formatShortDay(day)
          const dateStr = toDateString(day)

          return (
            <button
              key={dateStr}
              ref={selected ? selectedRef : undefined}
              onClick={() => onSelectDate(day)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                selected
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              {/* Número del día */}
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold',
                  todayDay && !selected && 'ring-2 ring-blue-500 ring-offset-1',
                )}
              >
                {num}
              </span>

              {/* Nombre del día */}
              <span className={cn('text-base capitalize', selected ? 'text-blue-100' : 'text-gray-500')}>
                {label}
              </span>

              {/* Indicador "hoy" */}
              {todayDay && (
                <span
                  className={cn(
                    'ml-auto shrink-0 rounded-full px-2 py-0.5 text-sm font-medium',
                    selected ? 'bg-blue-500 text-blue-100' : 'bg-blue-100 text-blue-600'
                  )}
                >
                  hoy
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
