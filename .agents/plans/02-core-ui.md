# Fase 2 · UI Core — La Agenda

Duración estimada: 3 días  
Dependencias: Fase 1 completa

---

## Objetivos

Interfaz completa y funcional visualmente. El abogado puede navegar fechas, crear tareas y tachlarlas. Los datos pueden ser mock todavía — la integración real viene en Fase 3.

---

## Layout principal

### Estructura de paneles (landscape-first)

```
src/app/agenda/page.tsx  →  Server Component (auth guard)
  └── AgendaLayout.tsx   →  Client Component (estado de fecha seleccionada)
       ├── DateNavigator.tsx   (panel izquierdo, ~280px fijo)
       └── DayView.tsx         (panel derecho, flex-1)
```

```
┌────────────────────────────────────────────────────────────┐
│  AGENDA LEGAL                                    [avatar]   │
├──────────────────┬─────────────────────────────────────────┤
│  DateNavigator   │  DayView                                 │
│                  │                                          │
│  ◄ Feb 2026 ►   │  Miércoles 11 · Febrero                  │
│  ─────────────   │  ─────────────────────────────────────   │
│  Lun 09          │  ⚡ 09:00  Audiencia Gutierrez   [ ]    │
│  Mar 10          │  ⚡ 15:00  Reunión Moreno         [ ]   │
│  Mié 11  ← hoy   │  ────────────────────────────────────   │
│  Jue 12          │  ✅ Llamar a C. Aguirre                  │
│  Vie 13          │  □  Preparar denuncia Coletti            │
│  Sáb 14          │  □  Mendiola subsanar                    │
│  ─────────────   │  □  Escrito Tueros pericia contable      │
│  Lun 16          │  ── Arrastradas de ayer (2) ──────────   │
│  Mar 17          │  □  Preparar apelación Yuen              │
│  ...             │  □  AM Duran Nippon                      │
│                  │                                          │
│  [Mini calendar] │  + Escribí acá y presioná Enter...       │
│                  │                                          │
└──────────────────┴─────────────────────────────────────────┘
```

**Breakpoints**:
- `lg` (≥1024px): layout 2 paneles (tablet landscape + PC)
- `<lg` (mobile portrait): solo DayView visible, DateNavigator como sheet/drawer

---

## Componentes a implementar

### AgendaLayout.tsx
```typescript
// Client Component
// Estado: selectedDate (Date) — inicializa en HOY
// Proporciona selectedDate y setSelectedDate a hijos via props o context
// Detecta si landscape/portrait para layout responsivo
```

### DateNavigator.tsx
```typescript
// Panel izquierdo
// Props: selectedDate, onSelectDate

// Comportamiento:
// - Muestra lista de días del mes actual (Lun-Sáb, sin domingos)
// - HOY siempre visible y destacado (badge circular azul)
// - Día seleccionado: fondo azul
// - Días con tareas: dot indicator debajo del número
// - Navegación de mes: ◄ Mes ►
// - "Ir a hoy" si estás en otro mes
// - Al cambiar de mes, scroll suave a la primera semana visible

// IMPORTANTE: getWorkingDaysOfMonth(year, month): Date[]
// Filtra domingos — nunca aparecen en la lista
```

### DayView.tsx
```typescript
// Panel derecho
// Props: date (Date), tasks (Task[])

// Secciones:
// 1. Header: "Miércoles 11 · Febrero 2026"
// 2. Timed tasks (tienen time !== null) — ordenadas por hora
// 3. Divider si hay timed tasks
// 4. Regular tasks (time === null, completed = false) — por position
// 5. Sección "Arrastradas de ayer" (carried_from !== null) — colapsable
// 6. Tareas completadas — colapsables o al final con opacity 60%
// 7. TaskInput al final
```

### TaskItem.tsx
```typescript
// Props: task, onToggle, onDelete, onEdit

// Visualización por tipo:
// Audiencia: badge ⚖️ rojo/naranja
// Reunion:   badge 🤝 azul
// Llamada:   badge 📞 verde
// Plazo:     badge ⏰ amarillo
// Tarea:     sin badge (mayoría)
// Otro:      badge 📌 gris

// Si tiene hora: mostrar "09:00" antes del título en bold
// Si completada: texto tachado, opacity 60%
// Si arrastrada: indicador sutil "↩ ayer" al lado derecho
// Hover (o long press tablet): mostrar acciones (editar, borrar)
```

### TaskInput.tsx
```typescript
// Props: onSubmit(rawText: string)

// Comportamiento:
// 1. Input de texto (placeholder: "Escribí acá y presioná Enter...")
// 2. Al presionar Enter (o botón +):
//    a. Llamar parseTask(rawText) → ParsedTask
//    b. Si requiresTimePrompt === true → mostrar prompt inline:
//       "¿A qué hora? [___:___]  [Sin hora]  [Confirmar]"
//    c. Si no → confirmar directo
// 3. Input se limpia después de confirmar
// 4. Foco permanece en el input para seguir escribiendo

// El prompt de hora es inline (debajo del input), NO un modal
// [Sin hora] confirma sin hora aunque sea Audiencia/Reunion
```

### CarriedSection.tsx
```typescript
// Props: tasks (Task[] donde carried_from !== null)
// Colapsable: expandido por defecto
// Header: "↩ Arrastradas de ayer (N)" — click para colapsar
// Aparece SOLO si hay tareas arrastradas
```

---

## Utilidades de fechas (src/lib/utils/dates.ts)

```typescript
// isWorkingDay(date: Date): boolean
// - false si date.getDay() === 0 (domingo)
// - true para Lun-Sáb

// getLastWorkingDay(date: Date): Date
// - Retrocede 1 día, saltando domingos

// getNextWorkingDay(date: Date): Date
// - Avanza 1 día, saltando domingos

// getWorkingDaysOfMonth(year: number, month: number): Date[]
// - Retorna todos los días Lun-Sáb del mes dado
// - month: 0-indexed (0=Enero)

// formatDateHeader(date: Date): string
// - "Miércoles 11 · Febrero 2026"
// - Usar date-fns con locale es

// formatShortDay(date: Date): string
// - "11\nMié" (número arriba, día abreviado abajo)

// isSameDay(a: Date, b: Date): boolean
// - Comparar solo año, mes, día (ignorar hora)

// isToday(date: Date): boolean
// - isSameDay(date, new Date())

// dateToString(date: Date): string
// - "2026-02-11" (YYYY-MM-DD para Supabase)

// stringToDate(str: string): Date
// - "2026-02-11" → Date (medianoche local)
```

---

## Diseño visual — guía de tokens

```
Colores base:
- Fondo app: bg-gray-50 (claro, sin ser blanco puro)
- Panel izquierdo: bg-white con border-r
- Día seleccionado: bg-blue-600 text-white
- HOY (no seleccionado): ring-2 ring-blue-500
- Tarea completada: opacity-60 line-through

Tipografía:
- Header día: text-2xl font-bold
- Hora de evento: text-sm font-semibold tabular-nums
- Título tarea: text-base
- Día en navegador: text-sm font-medium

Espaciado:
- Gap entre tareas: space-y-1
- Padding panel izq: px-3 py-2
- Padding DayView: px-6 py-4
```

---

## Checklist de done

- [ ] La app abre en HOY sin ninguna acción del usuario
- [ ] Se puede navegar a cualquier fecha clickeando en DateNavigator
- [ ] Los domingos NO aparecen en ningún lado
- [ ] Se pueden crear tareas (con mock/local state)
- [ ] Auto-detección de tipo funciona (sin integración DB todavía)
- [ ] Prompt inline de hora aparece para Audiencia/Reunion/Plazo
- [ ] Se pueden tachar tareas (toggle completed)
- [ ] Diseño funciona en tablet landscape (1024px+) Y en mobile portrait
- [ ] `npm run lint` 0 errores
