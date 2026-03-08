'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import TaskItem from '@/components/agenda/TaskItem'
import SortableTaskItem from '@/components/agenda/SortableTaskItem'
import CarriedSection from '@/components/agenda/CarriedSection'
import TaskInput from '@/components/agenda/TaskInput'
import { formatDateHeader, toDateString } from '@/lib/utils/dates'
import type { Task, TaskType } from '@/lib/types/database'

interface TaskSubmitData {
  title: string
  type: TaskType
  time: string | null
  date?: string  // opcional — si viene de voz con fecha distinta al día seleccionado
}

interface DayViewProps {
  date: Date
  tasks: Task[]
  loading?: boolean
  error?: string | null
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onEditTask: (id: string, updates: { title: string; time: string | null }) => void
  onAddTask: (data: TaskSubmitData & { date: string }) => void
  onReorderTasks?: (orderedIds: string[]) => void
}

export default function DayView({
  date,
  tasks,
  loading = false,
  error = null,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAddTask,
  onReorderTasks,
}: DayViewProps) {
  // Calcular si es un día pasado (sin estado, se deriva de la prop date)
  const isPastDay = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d < today
  })()

  // Días pasados → completadas siempre expandidas para ver el historial
  const [showCompleted, setShowCompleted] = useState(isPastDay)

  // ── DnD sensors — soporte pointer (desktop) y touch (tablet) ──────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // evitar drag al hacer click
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 }, // hold 200ms en tablet
    })
  )

  // ── Clasificar tareas ──────────────────────────────────────────────────────
  const timedActive = tasks
    .filter((t) => t.time !== null && !t.completed && t.carried_from === null)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  const regularActive = tasks
    .filter((t) => t.time === null && !t.completed && t.carried_from === null)
    .sort((a, b) => a.position - b.position)

  const carried = tasks
    .filter((t) => t.carried_from !== null && !t.completed)

  const completed = tasks.filter((t) => t.completed)

  function handleAddTask(data: TaskSubmitData) {
    // Si viene de voz con fecha propia la usamos; si no, el día seleccionado
    onAddTask({ ...data, date: data.date ?? toDateString(date) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = regularActive.findIndex((t) => t.id === active.id)
    const newIndex = regularActive.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(regularActive, oldIndex, newIndex)
    onReorderTasks?.(reordered.map((t) => t.id))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header del día */}
      <div className="shrink-0 border-b border-gray-100 px-4 py-2">
        <h2 className="text-3xl font-bold text-gray-900 xl:text-4xl">
          {formatDateHeader(date)}
        </h2>
        {loading ? (
          <p className="text-base text-gray-400">Cargando...</p>
        ) : error ? (
          <p className="text-lg text-red-500">{error}</p>
        ) : isPastDay ? (
          <p className="text-lg text-gray-400">
            {completed.length > 0
              ? `${completed.length} completada${completed.length !== 1 ? 's' : ''} · historial`
              : 'Sin actividad registrada'}
          </p>
        ) : tasks.length > 0 ? (
          <p className="text-lg text-gray-400">
            {tasks.filter((t) => !t.completed).length} pendiente
            {tasks.filter((t) => !t.completed).length !== 1 ? 's' : ''}
            {completed.length > 0 && ` · ${completed.length} completada${completed.length !== 1 ? 's' : ''}`}
          </p>
        ) : null}
      </div>

      {/* Lista de tareas — scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">

        {/* Estado loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl animate-pulse">⏳</p>
            <p className="mt-2 text-xl text-gray-400">Cargando tareas...</p>
          </div>
        )}

        {/* Contenido — solo visible cuando no está cargando */}
        {!loading && (
          <>
            {/* Tareas con hora — solo días presentes/futuros */}
            {!isPastDay && timedActive.length > 0 && (
              <section className="mb-1">
                <div className="space-y-0.5">
                  {timedActive.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={onToggleTask}
                      onDelete={onDeleteTask}
                      onEdit={onEditTask}
                    />
                  ))}
                </div>
                {regularActive.length > 0 || carried.length > 0 ? (
                  <div className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                ) : null}
              </section>
            )}

            {/* Tareas regulares — con drag & drop — solo días presentes/futuros */}
            {!isPastDay && regularActive.length > 0 && (
              <section className="mb-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={regularActive.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0.5">
                      {regularActive.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          onToggle={onToggleTask}
                          onDelete={onDeleteTask}
                          onEdit={onEditTask}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            )}

            {/* Tareas arrastradas — solo días presentes/futuros */}
            {!isPastDay && (
              <CarriedSection
                tasks={carried}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
                onEdit={onEditTask}
              />
            )}

            {/* Tareas completadas */}
            {completed.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="flex w-full items-center gap-1.5 rounded px-3 py-1.5 text-left text-lg font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                >
                  {showCompleted ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>Completadas ({completed.length})</span>
                </button>

                {showCompleted && (
                  <div className="mt-1 space-y-0.5">
                    {completed.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={onToggleTask}
                        onDelete={onDeleteTask}
                        onEdit={onEditTask}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Estado vacío */}
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-3xl">{isPastDay ? '📂' : '📋'}</p>
                <p className="mt-2 text-xl font-medium text-gray-500">
                  {isPastDay ? 'Sin actividad registrada' : 'Sin tareas para este día'}
                </p>
                {!isPastDay && (
                  <p className="mt-1 text-lg text-gray-400">Usá el input de abajo para agregar una</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input — fijo al fondo — solo si no es día pasado */}
      {!isPastDay && (
        <div className="shrink-0">
          <TaskInput onSubmit={handleAddTask} selectedDate={date} />
        </div>
      )}
    </div>
  )
}
