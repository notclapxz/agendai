import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toDateString } from '@/lib/utils/dates'
import type { MonthTask } from '@/lib/types/database'

// ─── Campos explícitos — NUNCA select('*') ─────────────────────────────────
const MONTH_TASK_FIELDS = 'id, date, title, type, completed'

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface UseMonthTasksReturn {
  tasksByDate: Record<string, MonthTask[]>
  loading: boolean
  error: string | null
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Carga tareas no completadas del mes dado para el usuario.
 * month es 0-indexed (convención JS: 0 = enero, 11 = diciembre).
 * Retorna tasksByDate: mapa 'YYYY-MM-DD' → MonthTask[].
 */
export function useMonthTasks(
  year: number,
  month: number,
  userId: string
): UseMonthTasksReturn {
  const [tasksByDate, setTasksByDate] = useState<Record<string, MonthTask[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadMonthTasks() {
      setLoading(true)
      setError(null)

      try {
        const firstDay = toDateString(new Date(year, month, 1))
        const lastDay = toDateString(new Date(year, month + 1, 0))

        const { data, error: fetchError } = await supabase
          .from('tasks')
          .select(MONTH_TASK_FIELDS)
          .eq('user_id', userId)
          .eq('completed', false)
          .gte('date', firstDay)
          .lte('date', lastDay)
          .order('date', { ascending: true })
          .order('position', { ascending: true })

        if (cancelled) return
        if (fetchError) throw fetchError

        const byDate: Record<string, MonthTask[]> = {}
        for (const task of (data as MonthTask[]) ?? []) {
          if (!byDate[task.date]) {
            byDate[task.date] = []
          }
          byDate[task.date]!.push(task)
        }

        setTasksByDate(byDate)
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          setError(msg)
          console.error('[useMonthTasks] Error loading month tasks', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMonthTasks()

    return () => {
      cancelled = true
    }
  }, [year, month, userId])

  return { tasksByDate, loading, error }
}
