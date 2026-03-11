'use client'

import { useEffect, useRef } from 'react'
import { Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecordingPanelProps {
  stream: MediaStream
  onStop: () => void
  onCancel: () => void
  elapsed: number // segundos — controlado desde TaskInput
}

// ─── Helper: formatear MM:SS ─────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Helper: dibujar waveform en canvas ──────────────────────────────────────

function drawBars(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  dataArray: Uint8Array<ArrayBuffer>,
  animFrameRef: { current: number },
  isMobile: boolean,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio ?? 1
  const barColor = isMobile ? '#3b82f6' : '#22c55e'

  // Dimensiones físicas actuales del canvas (se leen en cada frame)
  let lastW = 0
  let lastH = 0

  const draw = () => {
    animFrameRef.current = requestAnimationFrame(draw)

    // getBoundingClientRect() retorna dimensiones reales siempre,
    // incluso cuando offsetWidth/offsetHeight aún no están listos
    const rect = canvas.getBoundingClientRect()
    const cssWidth = rect.width
    const cssHeight = rect.height

    // Re-sincronizar canvas físico solo cuando cambien las dimensiones
    // Al resetear width/height el ctx.setTransform vuelve a identidad,
    // por eso llamamos scale() solo tras el reset — sin acumulación
    if (cssWidth !== lastW || cssHeight !== lastH) {
      lastW = cssWidth
      lastH = cssHeight
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    if (cssWidth === 0 || cssHeight === 0) return

    analyser.getByteFrequencyData(dataArray)

    // Fallback Safari: si getByteFrequencyData retorna zeros, usar timeDomain
    const hasFreqData = dataArray.some((v) => v > 0)
    if (!hasFreqData) {
      analyser.getByteTimeDomainData(dataArray)
    }

    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const barCount = 40
    const gap = 2
    const barWidth = (cssWidth - gap * (barCount - 1)) / barCount
    const step = Math.floor(dataArray.length / barCount)

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] ?? 0
      const normalizedHeight = hasFreqData
        ? Math.max(4, (value / 255) * cssHeight)
        : Math.max(4, Math.abs((value - 128) / 128) * cssHeight)

      const x = i * (barWidth + gap)
      const y = (cssHeight - normalizedHeight) / 2

      ctx.fillStyle = barColor
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, normalizedHeight, 2)
      ctx.fill()
    }
  }

  draw()
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function RecordingPanel({ stream, onStop, onCancel, elapsed }: RecordingPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // ── Web Audio API lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Compatibilidad Safari: webkit prefix
    const AudioContextClass =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return

    const audioCtx = new AudioContextClass()
    audioCtxRef.current = audioCtx

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.minDecibels = -80
    analyser.maxDecibels = -10
    analyser.smoothingTimeConstant = 0.8

    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)

    // Uint8Array<ArrayBuffer> requerido por AnalyserNode.getByteFrequencyData
    const dataArray = new Uint8Array(analyser.frequencyBinCount) as unknown as Uint8Array<ArrayBuffer>

    // Detectar mobile con matchMedia — sin acceder a window.innerWidth directamente
    const isMobile = !window.matchMedia('(min-width: 768px)').matches

    drawBars(canvas, analyser, dataArray, animFrameRef, isMobile)

    // Capturar la ref en variable local para el cleanup (react-hooks/exhaustive-deps)
    const animRef = animFrameRef

    return () => {
      cancelAnimationFrame(animRef.current)
      void audioCtx.close()
    }
  }, [stream])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay mobile — solo visible en < md */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel principal */}
      <div
        className={cn(
          // Base — compartido mobile/desktop
          'z-50 flex flex-col items-center gap-4 bg-white',
          // Mobile: bottom-sheet fijo
          'fixed bottom-0 left-0 right-0 min-h-[40vh] rounded-t-2xl px-6 pb-8 pt-6',
          // Desktop: inline, sin posición fija
          'md:relative md:bottom-auto md:left-auto md:right-auto md:min-h-0 md:rounded-lg md:px-4 md:py-4',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Panel de grabación de voz"
      >
        {/* Indicador de arrastre mobile */}
        <div className="h-1 w-12 rounded-full bg-gray-200 md:hidden" aria-hidden="true" />

        {/* Waveform canvas */}
        <div className="w-full" style={{ height: '64px' }}>
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ display: 'block', height: '64px' }}
            aria-hidden="true"
          />
        </div>

        {/* Estado: "Grabando…" con dot animado */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-700">Grabando…</span>
          {/* Cronómetro MM:SS */}
          <span className="font-mono text-sm tabular-nums text-gray-500">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Botón STOP prominente */}
        <Button
          variant="destructive"
          size="lg"
          onClick={onStop}
          className="min-h-12 min-w-12 gap-2 px-8"
          aria-label="Detener grabación"
        >
          <Square className="h-4 w-4 fill-current" />
          <span>Detener</span>
        </Button>

        {/* Cancelar — texto secundario */}
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600"
          aria-label="Cancelar grabación"
        >
          Cancelar
        </button>
      </div>
    </>
  )
}
