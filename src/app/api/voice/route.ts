import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface VoiceTask {
  title: string
  type: 'Tarea' | 'Audiencia' | 'Reunion' | 'Llamada' | 'Plazo' | 'Escrito' | 'Otro'
  time: string | null
  date: string | null  // YYYY-MM-DD — null = usar el día seleccionado
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
    const audioFile = formData.get('audio')
    const todayStr  = formData.get('today') as string | null   // YYYY-MM-DD enviado por el cliente
    const selectedDateStr = formData.get('selectedDate') as string | null  // día que está viendo

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'Audio requerido' }, { status: 400 })
    }

    if (!todayStr || !selectedDateStr) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })
    }

    // ── 1. Whisper — audio → texto ────────────────────────────────────────────

    const whisperForm = new FormData()
    whisperForm.append('file', audioFile, 'audio.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'es')
    whisperForm.append('response_format', 'text')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      console.error('[voice] Whisper error', await whisperRes.text())
      return NextResponse.json({ error: 'Error al transcribir audio' }, { status: 500 })
    }

    const transcript = (await whisperRes.text()).trim()
    if (!transcript) {
      return NextResponse.json({ error: 'No se detectó voz' }, { status: 400 })
    }

    // ── 2. gpt-4o-mini — texto → tareas estructuradas con fechas ─────────────

    const systemPrompt = `Sos un asistente de agenda para un abogado peruano.
Convertí el texto hablado en una lista de tareas JSON.

Contexto de fechas:
- Hoy es: ${todayStr} (${getDayName(todayStr)})
- Día seleccionado en la agenda: ${selectedDateStr}
- Semana: Lunes a Sábado. Los domingos NO EXISTEN — si una fecha calculada cae domingo, usá el lunes siguiente.

Tipos válidos (exactamente así, case-sensitive):
- "Tarea" → tarea genérica, preparar documentos, etc.
- "Audiencia" → audiencia, declaración testimonial, declaración indagatoria, testimonial, indagatoria
- "Reunion" → reunión, junta, encuentro
- "Llamada" → llamar, llamada, contactar por teléfono
- "Plazo" → plazo, vencimiento, deadline, fecha límite
- "Escrito" → escrito, escrito judicial, presentar escrito, redactar escrito
- "Otro" → cualquier otra cosa

Reglas de fecha:
- Si menciona "mañana" → día siguiente laborable a HOY
- Si menciona "el lunes", "el martes", etc. → próximo día de esa semana desde HOY
- Si menciona "la próxima semana" → lunes de la próxima semana
- Si menciona un mes ("en marzo", "el 15 de marzo") → calcular la fecha exacta del año en curso
- Si NO menciona ninguna fecha → devolvé null (se usará el día seleccionado)
- Formato de fecha devuelta: "YYYY-MM-DD"

Reglas de hora:
- Si menciona hora → extraerla en formato "HH:MM" (24h). "a las 3" = "15:00", "a las 9" = "09:00"
- Si no hay hora → null

Reglas generales:
- Separar correctamente cuando haya múltiples tareas
- El título debe ser limpio, sin la hora ni la fecha si ya las extrajiste
- Respondé SOLO con JSON válido, sin markdown

Formato:
[{"title": "...", "type": "...", "time": "HH:MM" | null, "date": "YYYY-MM-DD" | null}]`

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
      }),
    })

    if (!chatRes.ok) {
      console.error('[voice] GPT error', await chatRes.text())
      return NextResponse.json({ error: 'Error al procesar tareas' }, { status: 500 })
    }

    const chatData = await chatRes.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const raw = chatData.choices[0]?.message?.content?.trim() ?? '[]'

    let tasks: VoiceTask[]
    try {
      tasks = JSON.parse(raw) as VoiceTask[]
      if (!Array.isArray(tasks)) throw new Error('Not an array')
    } catch {
      console.error('[voice] JSON parse error', raw)
      return NextResponse.json({ error: 'Respuesta inválida del modelo' }, { status: 500 })
    }

    // Sanitizar
    const validTypes = ['Tarea', 'Audiencia', 'Reunion', 'Llamada', 'Plazo', 'Escrito', 'Otro']
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const timeRegex = /^\d{2}:\d{2}$/

    const sanitized: VoiceTask[] = tasks
      .filter((t) => t.title && typeof t.title === 'string')
      .map((t) => ({
        title: t.title.trim(),
        type: validTypes.includes(t.type) ? t.type : 'Tarea',
        time: typeof t.time === 'string' && timeRegex.test(t.time) ? t.time : null,
        date: typeof t.date === 'string' && dateRegex.test(t.date) ? t.date : null,
      }))

    return NextResponse.json({ tasks: sanitized, transcript })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[voice] Unexpected error', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getDayName(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const d = new Date(`${dateStr}T12:00:00`)
  return days[d.getDay()] ?? ''
}
