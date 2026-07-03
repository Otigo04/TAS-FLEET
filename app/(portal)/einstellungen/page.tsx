import { SettingsCrud } from '@/components/portal/settings-crud'
import { requireCompletedUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { getCurrentSuperadmin } from '@/lib/superadmin'
import { can } from '@/lib/roles'
import { listCompanyMembers } from '@/actions/member-actions'

export default async function EinstellungenPage() {
  const { supabase, user, profile } = await requireCompletedUser()
  const company = await requireActiveCompany()
  const { isSuperadmin } = await getCurrentSuperadmin()

  // Die Mitgliederverwaltung ist dem Geschäftsführer (owner) vorbehalten.
  const canManageMembers = can(company.role, 'manageMembers', isSuperadmin)

  const [settingsResult, profileResult, members] = await Promise.all([
    supabase.from('settings').select('*').eq('company_id', company.id),
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
    canManageMembers ? listCompanyMembers(company.id) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Einstellungen</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Account verwalten und Systemwerte konfigurieren.</p>
      </div>

      <SettingsCrud
        initialSettings={settingsResult.data ?? []}
        userId={user.id}
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        email={user.email ?? ''}
        role={profile?.role ?? 'admin'}
        avatarUrl={profileResult.data?.avatar_url ?? null}
        lastSignInAt={user.last_sign_in_at ?? null}
        members={members}
      />
    </div>
  )
}
