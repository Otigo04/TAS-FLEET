import { SettingsCrud } from '@/components/portal/settings-crud'
import { createClient } from '@/lib/supabase/server'
import { requireCompletedUser } from '@/lib/auth'

export default async function EinstellungenPage() {
  const { supabase, user, profile } = await requireCompletedUser()

  const [settingsResult, profileResult] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
  ])

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Einstellungen</h1>
        <p className="mt-1 text-slate-600">Account verwalten und Systemwerte konfigurieren.</p>
      </div>

      <SettingsCrud
        initialSettings={settingsResult.data ?? []}
        userId={user.id}
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        email={user.email ?? ''}
        role={profile?.role ?? 'admin'}
        avatarUrl={profileResult.data?.avatar_url ?? null}
      />
    </div>
  )
}
