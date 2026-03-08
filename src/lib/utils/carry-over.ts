import { createClient } from '@/lib/supabase/client'
import { getLastWorkingDay, toDateString } from '@/lib/utils/dates'
import type { TaskInsert } from '@/lib/types/database'

/**
 * Verifica si se debe ejecutar carry-over para la fecha target.
 * Retorna true si:
 *   - No hay tareas arrastradas en targetDate (carried_from IS NOT NULL)
 *   - Y hay tareas incompletas en el último día laborable anterior
 */
export async function shouldCarryOver(targetDate: string): Promise<boolean> {
  const supabase = createClient()

  // ¿Ya se hizo carry-over en este día?
  const { count: alreadyCarried } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('date', targetDate)
    .not('carried_from', 'is', null)

  if ((alreadyCarried ?? 0) > 0) return false

  // ¿Hay tareas incompletas en el día anterior laborable?
  const prevDate = toDateString(getLastWorkingDay(new Date(`${targetDate}T12:00:00`)))

  const { count: pendingTasks } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('date', prevDate)
    .eq('completed', false)

  return (pendingTasks ?? 0) > 0
}

/**
 * Arrastra tareas incompletas del último día laborable a targetDate.
 * IDEMPOTENTE: verificar con shouldCarryOver() antes de llamar.
 * NO hace carry-over en cadena — solo del último día laborable directo a HOY.
 */
export async function performCarryOver(
  targetDate: string,
  userId: string
): Promise<void> {
  const supabase = createClient()

  const prevDate = toDateString(getLastWorkingDay(new Date(`${targetDate}T12:00:00`)))

  // Obtener tareas incompletas del día anterior (campos explícitos, NUNCA *)
  const { data: pendingTasks, error } = await supabase
    .from('tasks')
    .select('id, date, title, type, time, completed, position, carried_from')
    .eq('user_id', userId)
    .eq('date', prevDate)
    .eq('completed', false)
    .order('position', { ascending: true })

  if (error) {
    console.error('[carry-over] Error fetching pending tasks', error)
    return
  }

  if (!pendingTasks || pendingTasks.length === 0) return

  // Calcular posición: después de las tareas ya existentes en targetDate
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('position')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .order('position', { ascending: false })
    .limit(1)

  const maxExistingPos =
    existingTasks && existingTasks.length > 0
      ? (existingTasks[0]?.position ?? -1)
      : -1

  const inserts: (TaskInsert & { user_id: string })[] = pendingTasks.map((task, index) => ({
    user_id: userId,
    date: targetDate,
    title: task.title as string,
    type: task.type as TaskInsert['type'],
    time: task.time as string | null,
    carried_from: (task.carried_from as string | null) ?? prevDate,
    position: maxExistingPos + 1 + index,
  }))

  const { error: insertError } = await supabase.from('tasks').insert(inserts)

  if (insertError) {
    console.error('[carry-over] Error inserting carried tasks', insertError)
    return
  }

  // Eliminar las tareas originales del día anterior (se "movieron" al día siguiente)
  const originalTaskIds = pendingTasks.map((t) => t.id)
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .in('id', originalTaskIds)

  if (deleteError) {
    console.error('[carry-over] Error deleting original tasks', deleteError)
  }
}

/**
 * Entry point principal — llama a shouldCarryOver y performCarryOver juntos.
 * Llamar al abrir un día en DayView.
 * NUNCA hace carry-over para días futuros ni días pasados — solo HOY.
 */
export async function performCarryOverIfNeeded(
  targetDate: string,
  userId: string
): Promise<void> {
  // Fecha de hoy en hora LOCAL (misma función, evita off-by-one UTC)
  const today = toDateString(new Date())
  if (targetDate !== today) return

  const needed = await shouldCarryOver(targetDate)
  if (!needed) return
  await performCarryOver(targetDate, userId)
}
