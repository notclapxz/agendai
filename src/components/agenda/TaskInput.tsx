'use client'

import { useState, useRef } from 'react'
import { Plus, Clock, Mic, MicOff, Loader2, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseTask, parseTimeInput } from '@/lib/utils/task-parser'
import { TIMED_TASK_TYPES, TASK_TYPE_LABELS } from '@/lib/types/database'
import { toDateString } from '@/lib/utils/dates'
import type { TaskType, TaskSubmitData, VoiceTask } from '@/lib/types/database'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface TaskInputProps {
  onSubmit: (data: TaskSubmitData) => void
  selectedDate: Date  // día que está viendo el usuario
}

// ─── Helper: detectar mimeType soportado por MediaRecorder ───────────────────

function getSupportedMimeType(): string | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null

  // Orden de preferencia: webm+opus (Chrome/Firefox) → mp4/AAC (Safari/iOS)
  const candidates = [
    'audio/webm;codecs=opus',        // Chrome/Firefox — preferido
    'audio/webm',                    // Chrome/Firefox — fallback
    'audio/mp4;codecs=mp4a.40.2',   // Safari/iOS — AAC explícito
    'audio/mp4',                     // Safari/iOS — fallback
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return null
}

// ─── Helper fecha para preview de voz ────────────────────────────────────────

function formatVoiceDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const day = days[d.getDay()] ?? ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `→ ${day} ${dd}/${mm}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TaskInput({ onSubmit, selectedDate }: TaskInputProps) {
  // Estado texto normal
  const [value, setValue] = useState('')
  const [pendingTask, setPendingTask] = useState<{ title: string; type: TaskType } | null>(null)
  const [timeInput, setTimeInput] = useState('')

  // Estado voz
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [voiceTasks, setVoiceTasks] = useState<VoiceTask[] | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Guardamos el mimeType elegido para reutilizarlo en processAudio
  const mimeTypeRef = useRef<string>('audio/webm')

  // ── Flujo texto normal ───────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') confirmText()
  }

  function confirmText() {
    const raw = value.trim()
    if (!raw) return
    const parsed = parseTask(raw)
    if (parsed.requiresTimePrompt) {
      setPendingTask({ title: parsed.title, type: parsed.type })
      setTimeInput('')
      setTimeout(() => timeRef.current?.focus(), 50)
      return
    }
    submitOne({ title: parsed.title, type: parsed.type, time: parsed.time })
  }

  function handleConfirmWithTime() {
    if (!pendingTask) return
    submitOne({ ...pendingTask, time: parseTimeInput(timeInput) })
  }

  function handleSkipTime() {
    if (!pendingTask) return
    submitOne({ ...pendingTask, time: null })
  }

  function handleTimeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirmWithTime()
    if (e.key === 'Escape') handleSkipTime()
  }

  function submitOne(data: TaskSubmitData) {
    onSubmit(data)
    setValue('')
    setPendingTask(null)
    setTimeInput('')
    inputRef.current?.focus()
  }

  // ── Flujo voz ────────────────────────────────────────────────────────────

  async function startRecording() {
    setVoiceError(null)
    setVoiceTasks(null)

    // Detectar MIME type soportado ANTES de pedir acceso al micrófono
    const mimeType = getSupportedMimeType()
    if (!mimeType) {
      setVoiceError('Tu navegador no soporta grabación de voz.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mimeTypeRef.current = mimeType
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        void processAudio()
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setRecording(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al acceder al micrófono'
      setVoiceError(msg)
      console.error('[TaskInput] mic error', err)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setProcessing(true)
  }

  async function processAudio() {
    try {
      const mimeType = mimeTypeRef.current
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const form = new FormData()
      form.append('audio', blob, `audio.${ext}`)
      form.append('today', toDateString(new Date()))
      form.append('selectedDate', toDateString(selectedDate))

      const res = await fetch('/api/voice', { method: 'POST', body: form })
      const data = await res.json() as { tasks?: VoiceTask[]; error?: string; detail?: string }

      if (!res.ok || !data.tasks) {
        // En dev/debug: mostrar el detalle del error de OpenAI si viene
        const msg = data.detail
          ? `${data.error ?? 'Error'}: ${data.detail.slice(0, 120)}`
          : (data.error ?? 'Error al procesar el audio')
        setVoiceError(msg)
        return
      }

      setVoiceTasks(data.tasks)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setVoiceError(msg)
      console.error('[TaskInput] voice processing error', err)
    } finally {
      setProcessing(false)
    }
  }

  function confirmVoiceTasks() {
    if (!voiceTasks) return
    voiceTasks.forEach((t) => onSubmit({
      title: t.title,
      type: t.type,
      time: t.time,
      // null → undefined para que DayView use el día seleccionado
      date: t.date ?? undefined,
    }))
    setVoiceTasks(null)
    inputRef.current?.focus()
  }

  function discardVoiceTasks() {
    setVoiceTasks(null)
    setVoiceError(null)
    inputRef.current?.focus()
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-2">

      {/* Input principal */}
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 shrink-0 text-gray-400" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí acá y presioná Enter…"
          className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-gray-400"
          disabled={!!pendingTask || recording || processing}
        />

        {/* Botón micrófono */}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={processing || !!pendingTask || !!voiceTasks}
          aria-label={recording ? 'Detener grabación' : 'Grabar tarea por voz'}
          className={cn(
            'shrink-0 rounded-full p-1.5 transition-colors',
            recording
              ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200'
              : 'text-gray-400 hover:bg-gray-100 hover:text-blue-500',
            (processing || !!pendingTask || !!voiceTasks) && 'cursor-not-allowed opacity-40'
          )}
        >
          {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>

      {/* Procesando */}
      {processing && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Procesando audio…</span>
        </div>
      )}

      {/* Error de voz */}
      {voiceError && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <span>{voiceError}</span>
          <button onClick={() => setVoiceError(null)} className="ml-2 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Preview de tareas detectadas por voz */}
      {voiceTasks && voiceTasks.length > 0 && (
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="mb-2 text-xs font-medium text-blue-600">
            {voiceTasks.length} tarea{voiceTasks.length !== 1 ? 's' : ''} detectada{voiceTasks.length !== 1 ? 's' : ''}:
          </p>
          <ul className="mb-3 space-y-1">
            {voiceTasks.map((t, i) => (
              <li key={`${t.type}-${t.title}-${i}`} className="flex items-baseline gap-2 text-sm text-gray-800">
                <span className="shrink-0 text-blue-400">·</span>
                {t.time && (
                  <span className="shrink-0 tabular-nums font-semibold text-blue-600">
                    {t.time}
                  </span>
                )}
                {t.type !== 'Tarea' && (
                  <span className="shrink-0 text-xs text-gray-500">
                    {TASK_TYPE_LABELS[t.type]}
                  </span>
                )}
                <span>{t.title}</span>
                {t.date && (
                  <span className="shrink-0 text-xs font-medium text-violet-600">
                    {formatVoiceDate(t.date)}
                  </span>
                )}
                {TIMED_TASK_TYPES.includes(t.type) && !t.time && (
                  <span className="text-xs text-amber-500">sin hora</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={confirmVoiceTasks}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              Crear {voiceTasks.length === 1 ? 'tarea' : 'todas'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={discardVoiceTasks}
              className="h-7 px-3 text-xs text-gray-500"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Prompt inline de hora (flujo texto normal) */}
      {pendingTask && (
        <div className={cn(
          'mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2',
          'border border-blue-100 text-sm'
        )}>
          <Clock className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="font-medium text-blue-700">{pendingTask.title}</span>
          <span className="text-blue-500">—</span>
          <span className="text-blue-600">¿A qué hora?</span>
          <input
            ref={timeRef}
            type="text"
            inputMode="numeric"
            placeholder="09:00"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onKeyDown={handleTimeKeyDown}
            className={cn(
              'w-20 rounded border border-blue-200 bg-white px-2 py-1',
              'text-sm tabular-nums text-gray-800',
              'focus:border-blue-400 focus:outline-none'
            )}
          />
          <Button size="sm" variant="default" onClick={handleConfirmWithTime} className="h-7 px-3 text-xs">
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSkipTime} className="h-7 px-3 text-xs text-gray-500">
            Sin hora
          </Button>
        </div>
      )}
    </div>
  )
}
