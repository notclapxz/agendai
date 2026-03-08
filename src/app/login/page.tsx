'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-login: verificar si ya hay sesión activa
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          router.replace('/agenda')  // Ya logeado → redirect sin back
        }
      } catch (err: unknown) {
        // Sesión inválida/expirada → quedarse en login (silencioso)
        console.error('[LoginPage] Session check failed:', err)
      }
    }
    checkSession()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      // Acepta username sin @ — agrega @mlpperu.com automáticamente
      const email = form.email.includes('@')
        ? form.email
        : `${form.email}@mlpperu.com`

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      })

      if (authError) throw authError

      router.push('/agenda')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(msg)
      console.error('[LoginPage]', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Cabecera */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Agenda Legal
          </h1>
          <p className="mt-1 text-sm text-foreground/60">Estudio MLP — Lima, Perú</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="email">Usuario</Label>
            <Input
              id="email"
              type="text"
              autoComplete="off"
              autoFocus
              required
              placeholder=""
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder=""
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              disabled={loading}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <p className="text-center text-xs text-foreground/40">
          Sin acceso? Contacte al administrador.
        </p>
      </div>
    </main>
  )
}
