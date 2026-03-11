'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, CalendarDays, List, Menu, X } from 'lucide-react'
import CalendarView from '@/components/agenda/CalendarView'
import DateNavigator from '@/components/agenda/DateNavigator'
import DayView from '@/components/agenda/DayView'
import { getTodayWorkingDay, toDateString } from '@/lib/utils/dates'
import { useTasks } from '@/hooks/useTasks'
import { usePush } from '@/hooks/usePush'
import { cn } from '@/lib/utils'
import type { TaskSubmitData } from '@/lib/types/database'

interface AgendaLayoutProps {
  userId: string
  userEmail: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgendaLayout({ userId }: AgendaLayoutProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(getTodayWorkingDay)
  const [navOpen, setNavOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda')

  // Fix altura en PWA Android: 100dvh se calcula antes de que el viewport
  // termine de inicializarse en recargas. window.innerHeight siempre es exacto.
  // NO escuchamos 'resize' — eso dispara al abrir el teclado y causa parpadeo
  // negro en la barra de navegación de Samsung. Solo actualizamos en rotación.
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`)
    }
    setHeight()
    // Pequeño delay para que el OS termine de rotar antes de medir
    const onOrientationChange = () => setTimeout(setHeight, 150)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => window.removeEventListener('orientationchange', onOrientationChange)
  }, [])

  const selectedDateStr = toDateString(selectedDate)

  // ── Datos reales de Supabase ─────────────────────────────────────────────
  const { tasks, loading, error, createTask, toggleTask, deleteTask, updateTask, reorderTasks } = useTasks(
    selectedDateStr,
    userId
  )
  const { isSubscribed, isSupported, isLoading: pushLoading, error: pushError, subscribe, unsubscribe } = usePush()

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleAddTask({ title, type, time, date }: TaskSubmitData & { date: string }) {
    await createTask({ title, type, time, date })
  }

  async function handleToggleTask(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    await toggleTask(id, !task.completed)
  }

  async function handleDeleteTask(id: string) {
    await deleteTask(id)
  }

  async function handleEditTask(id: string, updates: { title: string; time: string | null }) {
    await updateTask(id, updates)
  }

  function handleDayClick(date: Date) {
    setSelectedDate(date)
    setViewMode('agenda')
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: 'var(--app-h, 100dvh)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-3">
          {/* Toggle navegador (solo mobile) */}
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Mostrar navegador de fechas"
          >
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2">
            {/* Logo MLP miniatura */}
            <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="MLP" className="h-7 w-7 object-cover" />
            </div>
            <span className="hidden text-sm font-bold text-gray-800 sm:block">
              Agenda
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón toggle agenda / calendario — primero */}
          <button
            onClick={() => setViewMode((v) => v === 'agenda' ? 'calendar' : 'agenda')}
            aria-label={viewMode === 'agenda' ? 'Ver calendario' : 'Ver agenda'}
            title={viewMode === 'agenda' ? 'Ver calendario mensual' : 'Ver agenda diaria'}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            {viewMode === 'agenda' ? (
              <CalendarDays className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </button>

          {/* Botón notificaciones — solo si el browser lo soporta */}
          {isSupported && (
            <div className="flex flex-col items-end">
              <button
                onClick={() => isSubscribed ? void unsubscribe() : void subscribe()}
                disabled={pushLoading}
                aria-label={isSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                title={isSubscribed ? 'Notificaciones activas — click para desactivar' : 'Activar notificaciones push'}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  isSubscribed
                    ? 'text-blue-600 hover:bg-blue-50'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                  pushLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSubscribed ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </button>
              {/* Error visible para diagnóstico */}
              {pushError && (
                <span className="absolute top-11 right-4 z-50 max-w-xs rounded bg-red-600 px-2 py-1 text-xs text-white shadow-lg">
                  {pushError}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Contenido principal ────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* DateNavigator — sidebar en desktop, overlay en mobile */}
        <aside
          className={cn(
            // Desktop: siempre visible
            'hidden lg:flex lg:w-[260px] xl:w-[300px] lg:shrink-0 lg:flex-col',
            'border-r border-gray-200 bg-white',
            // Mobile: overlay cuando navOpen
            navOpen && 'absolute inset-y-0 left-0 z-20 flex w-[272px] flex-col shadow-xl',
          )}
        >
          <DateNavigator
            selectedDate={selectedDate}

            onSelectDate={(date) => {
              setSelectedDate(date)
              setNavOpen(false)
            }}
          />
        </aside>

        {/* Backdrop mobile */}
        {navOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/20 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        {/* Panel principal — agenda o calendario */}
        <main className="flex-1 overflow-hidden">
          {viewMode === 'calendar' ? (
            <div className="h-full overflow-y-auto">
              <CalendarView
                selectedDate={selectedDate}
                userId={userId}
                onDayClick={handleDayClick}
              />
            </div>
          ) : (
            <DayView
              key={selectedDateStr}
              date={selectedDate}
              tasks={tasks}
              loading={loading}
              error={error}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onEditTask={handleEditTask}
              onAddTask={handleAddTask}
              onReorderTasks={reorderTasks}
            />
          )}
        </main>
      </div>
    </div>
  )
}
