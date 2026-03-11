import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VoiceTask } from '@/lib/types/database'

// ─── JSON Schema para gpt-5 structured output ────────────────────────────────

const VOICE_TASKS_SCHEMA = {
  name: 'voice_tasks',
  strict: true,
  schema: {
    type: 'object',
    required: ['tasks'],
    additionalProperties: false,
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'type', 'time', 'date'],
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
              description: 'Título de la tarea, sin incluir tipo ni hora',
            },
            type: {
              type: 'string',
              enum: ['Tarea', 'Audiencia', 'Reunion', 'Llamada', 'Plazo', 'Escrito', 'Otro'],
            },
            time: {
              type: ['string', 'null'],
              description: 'Hora en formato HH:MM o null si no se especificó',
            },
            date: {
              type: ['string', 'null'],
              description: 'Fecha en formato YYYY-MM-DD o null si se usa la fecha seleccionada',
            },
          },
        },
      },
    },
  },
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const audioFile      = formData.get('audio')
    const todayStr       = formData.get('today') as string | null
    const selectedDateStr = formData.get('selectedDate') as string | null

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'Audio requerido' }, { status: 400 })
    }

    if (!todayStr || !selectedDateStr) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })
    }

    // ── 1. gpt-4o-transcribe — audio → texto ──────────────────────────────────

    // Derivar ext desde el filename (no de audioFile.type — Safari lo envía vacío)
    const filename = (audioFile as File).name ?? 'audio.webm'
    const ext = filename.endsWith('.mp4') ? 'mp4' : 'webm'

    const transcribeForm = new FormData()
    transcribeForm.append('file', audioFile, `audio.${ext}`)
    transcribeForm.append('model', 'gpt-4o-transcribe')
    transcribeForm.append('language', 'es')
    // Pedimos json para leer .text de forma explícita (más robusto que 'text' plano)
    transcribeForm.append('response_format', 'json')

    const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: transcribeForm,
    })

    if (!transcribeRes.ok) {
      console.error('[voice] Transcription error', await transcribeRes.text())
      return NextResponse.json({ error: 'Error al transcribir audio' }, { status: 500 })
    }

    const transcribeData = await transcribeRes.json() as { text?: string; data?: { text?: string } }
    // Guard defensivo: cubrimos variantes del wrapper de la API
    const transcript = (transcribeData.text ?? transcribeData.data?.text ?? '').trim()

    if (!transcript) {
      return NextResponse.json({ error: 'No se detectó voz' }, { status: 400 })
    }

    // ── 2. gpt-4o-mini — texto → tareas estructuradas (json_schema) ──────────

    const dateReference = buildDateReference(todayStr)

    const systemPrompt = `Sos un asistente de agenda para un profesional.
Convertí el texto hablado en una lista de tareas estructuradas.

Contexto de fechas:
- Hoy es: ${todayStr} (${getDayName(todayStr)})
- Día seleccionado en la agenda: ${selectedDateStr}

Tabla de referencia — próximos 14 días desde hoy (usá ESTA tabla para resolver fechas relativas, NO hagas cálculos propios):
${dateReference}

Tipos válidos (exactamente así, case-sensitive):
- "Tarea" → tarea genérica, preparar documentos, etc.
- "Audiencia" → audiencia, declaración testimonial, declaración indagatoria, testimonial, indagatoria
- "Reunion" → reunión, junta, encuentro
- "Llamada" → llamar, llamada, contactar por teléfono
- "Plazo" → plazo, vencimiento, deadline, fecha límite
- "Escrito" → escrito, escrito judicial, presentar escrito, redactar escrito
- "Otro" → cualquier otra cosa

Reglas de fecha:
- Si menciona "mañana" → usá la primera fecha de la tabla de referencia (el día inmediato siguiente a hoy)
- Si menciona un día de la semana ("el lunes", "el martes", etc.) → buscá ese nombre en la tabla y usá su fecha exacta
- Si menciona "la próxima semana" → buscá el día mencionado en la segunda semana de la tabla
- Si menciona un mes ("en marzo", "el 15 de marzo") → calculá la fecha exacta del año en curso
- Si NO menciona ninguna fecha → devolvé null (se usará el día seleccionado en la agenda)
- Formato de fecha devuelta: "YYYY-MM-DD"

Reglas de hora:
- Si menciona hora → extraerla en formato "HH:MM" (24h). "a las 3" = "15:00", "a las 9" = "09:00"
- Si no hay hora → null

Reglas de separación de tareas (MUY IMPORTANTE):
- Cada tarea mencionada debe ser un elemento SEPARADO en el array de salida
- Conectores como "y", "también", "además", "y también" SIEMPRE indican una nueva tarea
- Ejemplo: "llamar a Juan y revisar expediente" → DOS tareas: [{title:"Llamar a Juan"}, {title:"Revisar expediente"}]
- Ejemplo: "audiencia a las 10 y reunión con Carlos a las 3" → DOS tareas separadas
- El título debe ser limpio, sin la hora ni la fecha si ya las extrajiste`

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: VOICE_TASKS_SCHEMA,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
      }),
    })

    if (!chatRes.ok) {
      const errBody = await chatRes.text()
      console.error('[voice] GPT error', chatRes.status, errBody)
      return NextResponse.json({ error: 'Error al procesar tareas', detail: errBody }, { status: 500 })
    }

    const chatData = await chatRes.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const raw = chatData.choices[0]?.message?.content?.trim() ?? '{}'

    let parsedTasks: VoiceTask[]
    try {
      const parsed = JSON.parse(raw) as { tasks?: VoiceTask[] }
      parsedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
    } catch {
      console.error('[voice] JSON parse error', raw)
      return NextResponse.json({ error: 'Respuesta inválida del modelo' }, { status: 500 })
    }

    // ── 3. Sanitización (defensa en profundidad) ───────────────────────────────

    const validTypes = ['Tarea', 'Audiencia', 'Reunion', 'Llamada', 'Plazo', 'Escrito', 'Otro']
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const timeRegex = /^\d{2}:\d{2}$/

    let sanitized: VoiceTask[] = parsedTasks
      .filter((t) => t.title && typeof t.title === 'string')
      .map((t) => ({
        title: t.title.trim(),
        type: validTypes.includes(t.type) ? t.type : 'Tarea',
        time: typeof t.time === 'string' && timeRegex.test(t.time) ? t.time : null,
        date: typeof t.date === 'string' && dateRegex.test(t.date) ? t.date : null,
      }))

    // Fallback: si el modelo no extrajo tareas pero hay transcripción, crear una tarea básica
    if (sanitized.length === 0 && transcript) {
      sanitized = [{
        title: transcript,
        type: 'Tarea',
        time: null,
        date: null,
      }]
    }

    return NextResponse.json({ tasks: sanitized, transcript })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[voice] Unexpected error', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayName(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const d = new Date(`${dateStr}T12:00:00`)
  return days[d.getDay()] ?? ''
}

/**
 * Genera una tabla de los próximos 14 días desde `todayStr` con su nombre
 * de día de la semana y fecha exacta. El modelo solo tiene que "lookupear"
 * en vez de hacer aritmética de calendario (que falla en edge cases).
 *
 * Ejemplo de salida:
 *   sábado    → 2026-03-14
 *   domingo   → 2026-03-15
 *   lunes     → 2026-03-16
 *   ...
 */
function buildDateReference(todayStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const lines: string[] = []
  const base = new Date(`${todayStr}T12:00:00`)

  for (let i = 1; i <= 14; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const name = days[d.getDay()] ?? ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    lines.push(`  ${name.padEnd(10)} → ${yyyy}-${mm}-${dd}`)
  }

  return lines.join('\n')
}
