import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaLayout from '@/components/agenda/AgendaLayout'

export default async function AgendaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <AgendaLayout
      userId={user.id}
      userEmail={user.email ?? ''}
    />
  )
}
