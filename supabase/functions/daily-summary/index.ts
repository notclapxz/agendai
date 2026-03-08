import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import webpush from "npm:web-push@3"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]!
}

/** Día laborable anterior (salta domingos). */
function getLastWorkingDay(date: Date): Date {
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 1)
  if (prev.getDay() === 0) prev.setDate(prev.getDate() - 1)
  return prev
}

/** Fecha de hoy en Lima (UTC-5). No usa DST. */
function getLimaToday(): Date {
  const nowUtc = new Date()
  // Lima es UTC-5 fijo (sin DST)
  const limaOffsetMs = -5 * 60 * 60 * 1000
  return new Date(nowUtc.getTime() + limaOffsetMs + nowUtc.getTimezoneOffset() * 60000)
}

/** Formatea hora HH:MM en Lima. */
function formatLimaTime(timeStr: string, dateStr: string): string {
  try {
    const dt = new Date(`${dateStr}T${timeStr}:00-05:00`)
    return dt.toLocaleTimeString("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return timeStr
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Configurar VAPID con las claves de entorno
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  )

  // Fecha de hoy en Lima
  const limaDate = getLimaToday()

  // Domingos no existen (cron ya filtra, pero doble check)
  if (limaDate.getDay() === 0) {
    return new Response("Sunday — skipping", { status: 200 })
  }

  const todayStr = toDateStr(limaDate)
  const yesterdayStr = toDateStr(getLastWorkingDay(limaDate))

  // ── 1. Carry-over antes del resumen ───────────────────────────────────────
  //    Garantiza que las tareas arrastradas estén en la DB aunque el usuario
  //    no haya abierto la app desde ayer.

  const { count: alreadyCarriedCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr)
    .not("carried_from", "is", null)

  if ((alreadyCarriedCount ?? 0) === 0) {
    const { data: pending } = await supabase
      .from("tasks")
      .select("id, user_id, title, type, time, position, carried_from")
      .eq("date", yesterdayStr)
      .eq("completed", false)

    if (pending && pending.length > 0) {
      const inserts = pending.map((t: Record<string, unknown>, i: number) => ({
        user_id: t.user_id,
        date: todayStr,
        title: t.title,
        type: t.type,
        time: t.time,
        carried_from: (t.carried_from as string | null) ?? yesterdayStr,
        position: (t.position as number) + i,
      }))
      await supabase.from("tasks").insert(inserts)

      // Eliminar las originales del día anterior (igual que hace el cliente)
      const originalIds = pending.map((t: Record<string, unknown>) => t.id as string)
      await supabase.from("tasks").delete().in("id", originalIds)
    }
  }

  // ── 2. Obtener tareas de hoy ───────────────────────────────────────────────

  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("user_id, title, type, time, carried_from")
    .eq("date", todayStr)
    .eq("completed", false)
    .order("time", { ascending: true, nullsFirst: false })

  if (!todayTasks || todayTasks.length === 0) {
    return new Response("No tasks today — skipping", { status: 200 })
  }

  type TaskRow = Record<string, unknown>

  // Agrupar por usuario
  const byUser = todayTasks.reduce<Record<string, TaskRow[]>>((acc, t) => {
    const uid = t.user_id as string
    if (!acc[uid]) acc[uid] = []
    acc[uid]!.push(t as TaskRow)
    return acc
  }, {})

  // ── 3. Enviar resumen por usuario ──────────────────────────────────────────

  for (const [userId, tasks] of Object.entries(byUser)) {
    // ¿Ya se envió hoy?
    const { data: alreadySent } = await supabase
      .from("notifications_log")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "summary")
      .eq("ref_date", todayStr)
      .maybeSingle()

    if (alreadySent) continue

    // Suscripciones del usuario
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", userId)

    if (!subs || subs.length === 0) continue

    // Armar mensaje
    const timedTasks = tasks.filter((t) => t.time !== null)
    const carriedCount = tasks.filter((t) => t.carried_from !== null).length

    let body = `${tasks.length} tarea${tasks.length !== 1 ? "s" : ""} para hoy`
    if (timedTasks.length > 0) {
      const first = timedTasks[0] as TaskRow
      body += ` · ${formatLimaTime(first.time as string, todayStr)} ${first.title}`
    }
    if (carriedCount > 0) {
      body += ` · ${carriedCount} arrastrada${carriedCount !== 1 ? "s" : ""}`
    }

    // Formatear fecha bonita para el título
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const dayName = dayNames[limaDate.getDay()] ?? ""
    const monthName = monthNames[limaDate.getMonth()] ?? ""
    const dateFormatted = `${dayName} ${limaDate.getDate()}/${monthName}`

    const payload = JSON.stringify({
      title: `📋 Agenda — ${dateFormatted}`,
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "daily-summary",
      data: { url: "/agenda" },
    })

    // Enviar a todos los dispositivos via VAPID
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: {
              p256dh: sub.p256dh as string,
              auth: sub.auth_key as string,
            },
          },
          payload,
          {
            urgency: "high",
            TTL: 86400, // 24 horas
          }
        )
        console.log("[daily-summary] push sent to", sub.endpoint)
      } catch (err) {
        console.error("[daily-summary] push failed", sub.endpoint, err)
        // Si el endpoint ya no existe (410), eliminar la suscripción
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint)
        }
      }
    }

    // Loggear para evitar duplicados
    await supabase.from("notifications_log").insert({
      user_id: userId,
      task_id: null,
      type: "summary",
      ref_date: todayStr,
    })

    console.log(`[daily-summary] resumen enviado a ${userId}: ${tasks.length} tareas`)
  }

  return new Response("OK", { status: 200 })
})
