'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { performCarryOverIfNeeded } from '@/lib/utils/carry-over'
import type { Task, TaskInsert, TaskUpdate } from '@/lib/types/database'

// ─── Campos explícitos — NUNCA select('*') ─────────────────────────────────
const TASK_FIELDS =
  'id, user_id, date, title, type, time, completed, completed_at, carried_from, position, created_at, updated_at'

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface UseTasksReturn {
  tasks: Task[]
  loading: boolean
  error: string | null
  createTask: (input: TaskInsert) => Promise<void>
  toggleTask: (id: string, completed: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  updateTask: (id: string, updates: TaskUpdate) => Promise<void>
  reorderTasks: (orderedIds: string[]) => Promise<void>
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTasks(date: string, userId: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Ref para el canal realtime — evita re-suscripción innecesaria
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // ── Cargar tareas + carry-over ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadTasks() {
      setLoading(true)
      setError(null)

      try {
        // 1. Carry-over lazy: antes de cargar, arrastrar si es necesario
        await performCarryOverIfNeeded(date, userId)

        // 2. Cargar tareas del día
        const { data, error: fetchError } = await supabase
          .from('tasks')
          .select(TASK_FIELDS)
          .eq('user_id', userId)
          .eq('date', date)
          .order('position', { ascending: true })

        if (cancelled) return
        if (fetchError) throw fetchError

        setTasks((data as Task[]) ?? [])
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          setError(msg)
          console.error('[useTasks] Error loading tasks', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTasks()

    return () => {
      cancelled = true
    }
  }, [date, userId])

  // ── Realtime subscription ───────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    // Cancelar suscripción anterior si existe
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`tasks:${userId}:${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task
            // Solo agregar si pertenece al día actual
            if (newTask.date === date) {
              setTasks((prev) => {
                // Evitar duplicados (puede llegar por optimistic update)
                if (prev.some((t) => t.id === newTask.id)) return prev
                return [...prev, newTask]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Task
            if (updated.date === date) {
              setTasks((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t))
              )
            } else {
              // La tarea cambió de fecha — quitarla del día actual
              setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Task).id))
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id))
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [date, userId])

  // ── CRUD ───────────────────────────────────────────────────────────────

  async function createTask(input: TaskInsert): Promise<void> {
    const supabase = createClient()

    // Position al final del día
    const maxPos = tasks.reduce((max, t) => Math.max(max, t.position), -1)
    const now = new Date().toISOString()

    // Optimistic update — solo si la tarea pertenece al día que está mostrando este hook
    const optimisticTask: Task = {
      id: crypto.randomUUID(),
      user_id: userId,
      date: input.date,
      title: input.title,
      type: input.type ?? 'Tarea',
      time: input.time ?? null,
      completed: false,
      completed_at: null,
      carried_from: input.carried_from ?? null,
      position: input.position ?? maxPos + 1,
      created_at: now,
      updated_at: now,
    }
    const isCurrentDay = input.date === date
    if (isCurrentDay) {
      setTasks((prev) => [...prev, optimisticTask])
    }

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert({
          ...input,
          user_id: userId,
          position: input.position ?? maxPos + 1,
        })
        .select(TASK_FIELDS)
        .single()

      if (insertError) throw insertError

      if (isCurrentDay) {
        // Reemplazar optimistic con el real (tiene el id real de la DB)
        setTasks((prev) =>
          prev.map((t) => (t.id === optimisticTask.id ? (data as Task) : t))
        )
      }
      // Si es otro día: el realtime se encargará de actualizar ese día cuando el usuario lo navegue
    } catch (err: unknown) {
      if (isCurrentDay) {
        // Rollback optimistic solo si habíamos agregado algo al estado
        setTasks((prev) => prev.filter((t) => t.id !== optimisticTask.id))
      }
      const msg = err instanceof Error ? err.message : 'Error al crear tarea'
      setError(msg)
      console.error('[useTasks] Error creating task', err)
    }
  }

  async function toggleTask(id: string, completed: boolean): Promise<void> {
    const supabase = createClient()
    const now = new Date().toISOString()

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed, completed_at: completed ? now : null, updated_at: now }
          : t
      )
    )

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          completed,
          completed_at: completed ? now : null,
          updated_at: now,
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateError) throw updateError
    } catch (err: unknown) {
      // Rollback: invertir el toggle
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, completed: !completed, completed_at: !completed ? now : null }
            : t
        )
      )
      const msg = err instanceof Error ? err.message : 'Error al actualizar tarea'
      setError(msg)
      console.error('[useTasks] Error toggling task', err)
    }
  }

  async function deleteTask(id: string): Promise<void> {
    const supabase = createClient()

    // Optimistic update — guardar para rollback
    const backup = tasks.find((t) => t.id === id)
    setTasks((prev) => prev.filter((t) => t.id !== id))

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (deleteError) throw deleteError
    } catch (err: unknown) {
      // Rollback
      if (backup) {
        setTasks((prev) => [...prev, backup].sort((a, b) => a.position - b.position))
      }
      const msg = err instanceof Error ? err.message : 'Error al eliminar tarea'
      setError(msg)
      console.error('[useTasks] Error deleting task', err)
    }
  }

  async function updateTask(id: string, updates: TaskUpdate): Promise<void> {
    const supabase = createClient()
    const now = new Date().toISOString()

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: now } : t
      )
    )

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateError) throw updateError
    } catch (err: unknown) {
      // Rollback: recargar del servidor
      const { data } = await supabase
        .from('tasks')
        .select(TASK_FIELDS)
        .eq('user_id', userId)
        .eq('date', date)
        .order('position', { ascending: true })

      if (data) setTasks(data as Task[])

      const msg = err instanceof Error ? err.message : 'Error al actualizar tarea'
      setError(msg)
      console.error('[useTasks] Error updating task', err)
    }
  }

  async function reorderTasks(orderedIds: string[]): Promise<void> {
    const supabase = createClient()
    const now = new Date().toISOString()

    // Optimistic update: asignar posición según el orden del array
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      return orderedIds
        .map((id, index) => {
          const task = map.get(id)
          return task ? { ...task, position: index, updated_at: now } : null
        })
        .filter((t): t is Task => t !== null)
        // Preservar tareas que no están en orderedIds (carried, timed, completed)
        .concat(prev.filter((t) => !orderedIds.includes(t.id)))
    })

    try {
      // Actualizar en paralelo
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('tasks')
            .update({ position: index, updated_at: now })
            .eq('id', id)
            .eq('user_id', userId)
        )
      )
    } catch (err: unknown) {
      // Rollback: recargar del servidor
      const { data } = await supabase
        .from('tasks')
        .select(TASK_FIELDS)
        .eq('user_id', userId)
        .eq('date', date)
        .order('position', { ascending: true })

      if (data) setTasks(data as Task[])

      const msg = err instanceof Error ? err.message : 'Error al reordenar tareas'
      setError(msg)
      console.error('[useTasks] Error reordering tasks', err)
    }
  }

  return {
    tasks,
    loading,
    error,
    createTask,
    toggleTask,
    deleteTask,
    updateTask,
    reorderTasks,
  }
}
