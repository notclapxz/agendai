'use client'

import { useState, useEffect } from 'react'

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface UsePushReturn {
  isSubscribed: boolean
  isSupported: boolean
  isLoading: boolean
  error: string | null
  subscribe: (deviceLabel?: string) => Promise<void>
  unsubscribe: () => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Convierte ArrayBuffer a base64url (formato que espera el servidor VAPID). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Convierte Base64URL string a Uint8Array (requerido por pushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePush(): UsePushReturn {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Inicializar en false para evitar hydration mismatch (server != client)
  // Se actualiza después del mount via useEffect
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    )
  }, [])

  // Verificar si ya hay suscripción activa al montar
  useEffect(() => {
    if (!isSupported) return

    async function checkSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(subscription !== null)
      } catch (err: unknown) {
        console.error('[usePush] Error checking subscription', err)
      }
    }

    void checkSubscription()
  }, [isSupported])

  async function subscribe(deviceLabel?: string): Promise<void> {
    if (!isSupported) {
      setError('Tu navegador no soporta notificaciones push')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Solicitar permiso al usuario
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Permiso denegado para notificaciones')
        return
      }

      // 2. Obtener service worker listo
      const registration = await navigator.serviceWorker.ready

      // 3. Suscribir al push service del navegador
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setError('VAPID public key no configurada')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // 4. Extraer claves de la suscripción
      const p256dh = subscription.getKey('p256dh')
      const auth = subscription.getKey('auth')

      if (!p256dh || !auth) {
        setError('No se pudieron obtener las claves de la suscripción')
        await subscription.unsubscribe()
        return
      }

      // 5. Guardar suscripción en el servidor
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
          deviceLabel: deviceLabel ?? getDeviceLabel(),
        }),
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Error al guardar suscripción')
      }

      setIsSubscribed(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al activar notificaciones'
      setError(msg)
      console.error('[usePush] Error subscribing', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!isSupported) return

    setIsLoading(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        setIsSubscribed(false)
        return
      }

      // 1. Eliminar del servidor
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      // 2. Cancelar suscripción en el SW
      await subscription.unsubscribe()
      setIsSubscribed(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al desactivar notificaciones'
      setError(msg)
      console.error('[usePush] Error unsubscribing', err)
    } finally {
      setIsLoading(false)
    }
  }

  return { isSubscribed, isSupported, isLoading, error, subscribe, unsubscribe }
}

// ─── Detectar dispositivo para label amigable ─────────────────────────────

function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Dispositivo desconocido'
  const ua = navigator.userAgent

  if (/Android/i.test(ua) && /Chrome/i.test(ua)) {
    if (/SM-[TX]/i.test(ua) || /tablet/i.test(ua)) return 'Tablet Samsung'
    return 'Android'
  }
  if (/Windows/i.test(ua)) return 'PC Windows'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  return 'Navegador'
}
