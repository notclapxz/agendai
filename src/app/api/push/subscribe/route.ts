import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

interface SubscribeBody {
  endpoint: string
  p256dh: string
  auth: string
  deviceLabel?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as SubscribeBody

    if (!body.endpoint || !body.p256dh || !body.auth) {
      return NextResponse.json(
        { error: 'Faltan campos: endpoint, p256dh, auth' },
        { status: 400 }
      )
    }

    // Upsert por endpoint — si ya existe, actualiza; si no, inserta
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth_key: body.auth,
        device_label: body.deviceLabel ?? null,
      },
      { onConflict: 'user_id, endpoint' }
    )

    if (error) throw error

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error
      ? err.message
      : (err as { message?: string }).message ?? 'Error desconocido'
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
