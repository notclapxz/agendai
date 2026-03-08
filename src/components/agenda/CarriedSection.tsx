'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TaskItem from '@/components/agenda/TaskItem'
import { formatCarriedFrom } from '@/lib/utils/dates'
import type { Task } from '@/lib/types/database'

interface CarriedSectionProps {
  tasks: Task[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string, updates: { title: string; time: string | null }) => void
}

export default function CarriedSection({ tasks, onToggle, onDelete, onEdit }: CarriedSectionProps) {
  const [expanded, setExpanded] = useState(true)

  if (tasks.length === 0) return null

  // Agrupar por fecha original (carried_from)
  const groups = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.carried_from ?? 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(task)
    return acc
  }, {})

  return (
    <div className="mt-4 space-y-2">
      {Object.entries(groups).map(([dateStr, groupTasks]) => (
        <div key={dateStr}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 rounded px-3 py-1.5 text-left text-lg font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>
              ↩ Arrastradas {dateStr !== 'unknown' ? formatCarriedFrom(dateStr) : 'de días anteriores'}
              {' '}({groupTasks.length})
            </span>
          </button>

          {expanded && (
            <div className="mt-1 space-y-0.5 border-l-2 border-gray-100 pl-1">
              {groupTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
