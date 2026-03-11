'use client'

import { useState, useEffect, useRef } from 'react'
import { Trash2, CornerDownLeft, GripVertical, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCarriedFrom } from '@/lib/utils/dates'
import { parseTimeInput } from '@/lib/utils/task-parser'
import type { Task, TaskType } from '@/lib/types/database'

// ─── Badge config por tipo ────────────────────────────────────────────────────

const BADGE_CONFIG: Partial<Record<TaskType, { label: string; className: string }>> = {
  Audiencia: { label: '⚖️ Audiencia',  className: 'bg-amber-100 text-amber-800'   },
  Reunion:   { label: '🤝 Reunión',    className: 'bg-blue-100 text-blue-800'     },
  Llamada:   { label: '📞 Llamada',    className: 'bg-green-100 text-green-800'   },
  Plazo:     { label: '⏰ Plazo',      className: 'bg-yellow-100 text-yellow-800' },
  Escrito:   { label: '📝 Escrito',    className: 'bg-purple-100 text-purple-800' },
  Evento:    { label: '📅 Evento',     className: 'bg-pink-100 text-pink-800'     },
  Documento: { label: '🗂️ Documento',  className: 'bg-indigo-100 text-indigo-800' },
  Otro:      { label: '📌 Otro',       className: 'bg-gray-100 text-gray-600'     },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskItemProps {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string, updates: { title: string; time: string | null }) => void
  /** Props del drag handle (inyectados por SortableTaskItem cuando aplica) */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  /** Si el ítem está siendo arrastrado actualmente */
  isDragging?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  dragHandleProps,
  isDragging = false,
}: TaskItemProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editTime, setEditTime] = useState(task.time?.slice(0, 5) ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus automático al entrar en modo edición
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function handleStartEdit() {
    setEditTitle(task.title)
    setEditTime(task.time?.slice(0, 5) ?? '')
    setEditing(true)
  }

  function handleSave() {
    const trimmed = editTitle.trim()
    if (!trimmed) return
    // Si escribió algo en el campo de hora intentamos parsearlo;
    // si el campo está vacío y la tarea ya tenía hora, la conservamos;
    // si el campo está vacío y la tarea no tenía hora, queda null.
    const parsedTime = parseTimeInput(editTime)
    const time = parsedTime ?? (editTime.trim() === '' ? task.time : null)
    onEdit(task.id, { title: trimmed, time })
    setEditing(false)
  }

  function handleCancel() {
    setEditTitle(task.title)
    setEditTime(task.time?.slice(0, 5) ?? '')
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') handleCancel()
  }

  const badge = task.type !== 'Tarea' ? BADGE_CONFIG[task.type] : undefined

  // ── Modo edición ──────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-2 ring-1 ring-blue-200">
        {/* Input título */}
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-2 py-1 text-lg text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Editar título de tarea"
        />
        {/* Input hora — siempre visible para poder agregar/editar */}
        <input
          type="text"
          inputMode="numeric"
          placeholder={task.time ? task.time.slice(0, 5) : 'HH:MM'}
          value={editTime}
          onChange={(e) => setEditTime(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-20 rounded border border-blue-300 bg-white px-2 py-1 text-base tabular-nums text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Hora (formato 24h, ej: 09:00 — dejar vacío para quitar)"
        />
        {/* Guardar */}
        <button
          onClick={handleSave}
          aria-label="Guardar cambios"
          className="shrink-0 rounded p-1.5 text-green-600 transition-colors hover:bg-green-100 active:bg-green-200"
        >
          <Check className="h-5 w-5" />
        </button>
        {/* Cancelar */}
        <button
          onClick={handleCancel}
          aria-label="Cancelar edición"
          className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 active:bg-gray-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    )
  }

  // ── Modo vista ────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-lg px-2.5 py-1.5 transition-colors',
        'hover:bg-gray-50',
        task.completed && 'opacity-60',
        isDragging && 'shadow-lg bg-white ring-1 ring-blue-200 opacity-90'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle — solo visible en hover */}
      {dragHandleProps !== undefined && (
        <button
          {...dragHandleProps}
          aria-label="Arrastrar tarea"
          className={cn(
            'mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-gray-300 transition-opacity active:cursor-grabbing',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded',
          'border-2 transition-colors',
          task.completed
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-gray-300 hover:border-blue-400'
        )}
      >
        {task.completed && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {/* Hora */}
          {task.time && (
            <span className="shrink-0 text-xl font-semibold tabular-nums text-blue-600">
              {task.time.slice(0, 5)}
            </span>
          )}

          {/* Badge de tipo */}
          {badge && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-lg font-medium',
                badge.className
              )}
            >
              {badge.label}
            </span>
          )}

          {/* Título */}
          <span className="text-xl text-gray-800">
            {task.title}
          </span>
        </div>

        {/* Indicador de arrastrada */}
        {task.carried_from && (
          <div className="mt-0.5 flex items-center gap-1 text-lg text-gray-400">
            <CornerDownLeft className="h-3.5 w-3.5" />
            <span>arrastrada {formatCarriedFrom(task.carried_from)}</span>
          </div>
        )}
      </div>

      {/* Editar — siempre visible */}
      <button
        onClick={handleStartEdit}
        aria-label="Editar tarea"
        className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:text-blue-500 active:text-blue-600"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {/* Borrar — siempre visible */}
      <button
        onClick={() => onDelete(task.id)}
        aria-label="Eliminar tarea"
        className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:text-red-500 active:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
