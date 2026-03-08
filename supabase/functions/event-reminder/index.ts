import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3"

// ─── Tipos internos ────────────────────────────────────────────────────────

type ReminderType = "reminder_3d" | "reminder_1d" | "reminder_1h"

interface TaskRow {
  id: string
  user_id: string
  date: string
  title: string
  type: string
  time: string
}

interface PushSub {
  endpoint: string
  p256dh: string
  auth_key: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]!
}

/** Fecha/hora actual en Lima (UTC-5, sin DST). */
function getLimaDate(): Date {
  const nowUtc = new Date()
  const limaOffsetMs = -5 * 60 * 60 * 1000
  return new Date(nowUtc.getTime() + limaOffsetMs + nowUtc.getTimezoneOffset() * 60000)
}

/** Fecha N días desde base (en Lima). */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Convierte 'HH:MM' en minutos desde medianoche. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Emoji por tipo de tarea. */
function emojiForType(type: string): string {
  const map: Record<string, string> = {
    Audiencia: "⚖️",
    Reunion: "🤝",
    Llamada: "📞",
    Plazo: "⏰",
    Tarea: "📄",
    Otro: "📌",
  }
  return map[type] ?? "📋"
}

/** Formatea fecha como "Jue 13/02". */
function formatShortDate(date: Date): string {
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  const day = dayNames[date.getDay()] ?? ""
  const d = date.getDate().toString().padStart(2, "0")
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  return `${day} ${d}/${m}`
}

// ─── Envío de push con manejo de errores ──────────────────────────────────────

async function sendPush(
  subs: PushSub[],
  payload: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        payload,
        {
          urgency: "high",
          TTL: 86400, // 24 horas
        }
      )
    } catch (err) {
      console.error("[event-reminder] push failed", sub.endpoint, err)
      // Suscripción expirada → eliminar
      if ((err as { statusCode?: number }).statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint)
      }
    }
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  )

  const limaDate = getLimaDate()

  // Domingos no existen
  if (limaDate.getDay() === 0) {
    return new Response("Sunday — skipping", { status: 200 })
  }

  const limaHour = limaDate.getHours()
  // Solo enviar entre 6 AM y 10 PM Lima
  if (limaHour < 6 || limaHour >= 22) {
    return new Response("Outside hours — skipping", { status: 200 })
  }

  const nowMinutes = limaHour * 60 + limaDate.getMinutes()
  const todayStr = toDateStr(limaDate)

  // ── Ventanas de tiempo para cada tipo de reminder ──────────────────────────
  //
  // El cron corre cada 30 min. Buscamos tasks cuya hora caiga en ventanas
  // de ±15 min alrededor del momento exacto del evento relativo.
  //
  // reminder_1h: evento en 45–75 min desde ahora
  // reminder_1d: evento mañana, hora entre 00:00 y 23:59 del día siguiente
  // reminder_3d: evento en exactamente 3 días, hora entre 00:00 y 23:59

  const windows: Array<{
    type: ReminderType
    date: string
    minMinutes?: number  // solo para reminder_1h (filtro por hora)
    maxMinutes?: number
  }> = [
    {
      type: "reminder_1h",
      date: todayStr,
      minMinutes: nowMinutes + 45,  // 45 min antes
      maxMinutes: nowMinutes + 75,  // 75 min antes
    },
    {
      type: "reminder_1d",
      date: toDateStr(addDays(limaDate, 1)),
    },
    {
      type: "reminder_3d",
      date: toDateStr(addDays(limaDate, 3)),
    },
  ]

  let totalSent = 0

  for (const window of windows) {
    // Saltar reminder_1d y reminder_3d si hoy es sábado y el target cae en domingo
    const targetDate = new Date(`${window.date}T12:00:00`)
    if (targetDate.getDay() === 0) continue

    // Query: tasks con hora en la fecha target
    const { data: candidates } = await supabase
      .from("tasks")
      .select("id, user_id, date, title, type, time")
      .eq("date", window.date)
      .eq("completed", false)
      .not("time", "is", null)

    if (!candidates || candidates.length === 0) continue

    for (const task of candidates as TaskRow[]) {
      const taskMinutes = timeToMinutes(task.time)

      // Para reminder_1h, filtrar por ventana de tiempo
      if (window.type === "reminder_1h") {
        const min = window.minMinutes ?? 0
        const max = window.maxMinutes ?? 0
        if (taskMinutes < min || taskMinutes > max) continue
      }

      // ¿Ya se envió este tipo para esta tarea?
      const { data: alreadySent } = await supabase
        .from("notifications_log")
        .select("id")
        .eq("task_id", task.id)
        .eq("type", window.type)
        .maybeSingle()

      if (alreadySent) continue

      // Suscripciones del usuario
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .eq("user_id", task.user_id)

      if (!subs || subs.length === 0) continue

      // Armar mensaje según el tipo
      const emoji = emojiForType(task.type)
      let title: string
      let body: string

      if (window.type === "reminder_1h") {
        title = `${emoji} En 1 hora`
        body = `${task.title} — ${task.time.slice(0, 5)}`
      } else if (window.type === "reminder_1d") {
        title = `${emoji} Mañana`
        body = `${task.title} — ${window.date.split("-").reverse().join("/")} ${task.time.slice(0, 5)}`
      } else {
        title = `${emoji} En 3 días`
        body = `${task.title} — ${formatShortDate(targetDate)} ${task.time.slice(0, 5)}`
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `${window.type}-${task.id}`,
        data: { url: `/agenda?date=${task.date}` },
      })

      await sendPush(subs as PushSub[], payload, supabase)

      // Loggear para evitar duplicados
      // El UNIQUE constraint en (task_id, type) garantiza idempotencia
      await supabase.from("notifications_log").upsert(
        {
          user_id: task.user_id,
          task_id: task.id,
          type: window.type,
          ref_date: window.date,
        },
        { onConflict: "task_id, type", ignoreDuplicates: true }
      )

      totalSent++
      console.log(`[event-reminder] ${window.type} sent for task ${task.id}: ${task.title}`)
    }
  }

  return new Response(`OK — ${totalSent} reminders sent`, { status: 200 })
})
