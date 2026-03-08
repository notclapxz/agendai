# Fase 3 · Data & Lógica de Tareas

Duración estimada: 2 días  
Dependencias: Fase 2 (UI completada con mock data)

---

## Objetivos

Conectar la UI a Supabase. Datos persisten, sincronizan entre dispositivos, carry-over funciona.

---

## Hook principal: useTasks

```typescript
// src/hooks/useTasks.ts
// Props: date (string YYYY-MM-DD), userId (string)

// Responsabilidades:
// 1. Cargar tasks para la fecha dada
// 2. Ejecutar carry-over lazy si es necesario
// 3. Suscribirse a cambios realtime (INSERT/UPDATE/DELETE)
// 4. Exponer: tasks, loading, error, createTask, toggleTask, deleteTask, reorderTask

interface UseTasksReturn {
  tasks: Task[]
  loading: boolean
  error: string | null
  createTask: (input: TaskInsert) => Promise<void>
  toggleTask: (id: string, completed: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  updateTask: (id: string, updates: TaskUpdate) => Promise<void>
  reorderTasks: (taskIds: string[]) => Promise<void>
}
```

---

## Carry-over lazy

```typescript
// src/lib/utils/carry-over.ts

// Función: performCarryOverIfNeeded(targetDate: string, userId: string)
// Se llama dentro de useTasks al montar el hook para la fecha target

// Algoritmo:
// 1. Calcular lastWorkingDay = getLastWorkingDay(targetDate)
// 2. Query: ¿Hay tasks con carried_from = lastWorkingDay en targetDate?
//    SELECT COUNT(*) FROM tasks WHERE user_id = X AND date = target AND carried_from IS NOT NULL
// 3. Si count > 0 → ya se hizo carry-over para este día, no hacer nada (return)
// 4. Query: tareas incompletas del último día laborable
//    SELECT * FROM tasks WHERE user_id = X AND date = lastWorkingDay AND completed = false
// 5. Si hay tareas → insertarlas con:
//    - date = targetDate
//    - carried_from = lastWorkingDay
//    - completed = false
//    - position = (max_position_actual + 1) en adelante
// 6. NO hacer carry-over en cadena. Solo desde el último día laborable a targetDate.

// CRITICAL: Esta operación debe ser idempotente.
// El UNIQUE index en notifications_log no aplica aquí, pero el check del paso 2
// garantiza que no se dupliquen. Considerar transacción o upsert si hay race conditions.
```

---

## CRUD de tareas

### createTask
```typescript
// 1. parseTask(rawText) → ParsedTask (type, time, title limpio)
// 2. Calcular position = tasks.length (al final)
// 3. INSERT en tasks con user_id del auth context
// 4. Optimistic update: agregar a lista local antes de que responda Supabase
// 5. Rollback si hay error

// La auto-detección sucede en TaskInput ANTES de llamar createTask
// createTask recibe el TaskInsert ya con type y time definidos
```

### toggleTask
```typescript
// UPDATE tasks SET completed = !current, completed_at = NOW()|NULL WHERE id = X
// Optimistic update inmediato en UI
```

### deleteTask
```typescript
// DELETE FROM tasks WHERE id = X AND user_id = Y (RLS también protege)
// Animación de salida antes de eliminar del DOM
// Confirmar con leve swipe o hold (no popup de confirmación — demasiado friction)
```

### reorderTasks
```typescript
// Actualizar position de múltiples tasks en un batch
// UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2
// Usar Promise.all para updates paralelos (no hay transacción necesaria aquí)
```

---

## Realtime sync

```typescript
// En useTasks, suscribirse al canal de Supabase Realtime:
const channel = supabase
  .channel(`tasks:${userId}:${date}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${userId}`  // filtramos por fecha en el handler
  }, (payload) => {
    // Filtrar por fecha y actualizar estado local
    // INSERT → agregar si date coincide
    // UPDATE → actualizar en lista
    // DELETE → remover de lista
  })
  .subscribe()

// Cleanup en useEffect return
```

---

## Ordenamiento de tareas en DayView

```
Orden de visualización (top to bottom):

1. Timed tasks (time !== null, completed = false)
   - Ordenadas por time ASC
   
2. Regular tasks (time === null, completed = false, carried_from === null)
   - Ordenadas por position ASC
   
3. Carried tasks (carried_from !== null, completed = false)
   - En sección colapsable "↩ Arrastradas"
   - Ordenadas por position ASC
   
4. Completed tasks (completed = true)
   - En sección colapsable "✅ Completadas (N)"
   - Ordenadas por completed_at DESC
```

---

## Reordenamiento (drag & drop en tablet)

Usar `@dnd-kit/core` (ya disponible en el proyecto abogados-app como referencia).

Solo las **regular tasks** (sección 2) son reordenables.  
Las timed tasks y carried tasks no son reordenables manualmente.

En tablet con teclado: también exponer botones ↑↓ en hover/focus de cada TaskItem.

---

## Checklist de done

- [ ] Tareas persisten en Supabase (verificar en Dashboard)
- [ ] Sync realtime: crear tarea en PC y aparece en tablet sin recargar
- [ ] Carry-over funciona: tarea incompleta del Viernes aparece el Lunes
- [ ] Carry-over NO ocurre en domingos
- [ ] Carry-over es idempotente (abrir el mismo día 2 veces no duplica tareas)
- [ ] Drag & drop funciona en tablet con touch
- [ ] Marcar completada mueve la tarea a sección "Completadas" con animación
- [ ] Eliminar tarea funciona sin popup de confirmación (swipe o hold)
- [ ] `npm run lint` 0 errores, `npm run build` pasa
