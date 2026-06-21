import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { requireCompletedUser } from '@/lib/auth'
import { getUserCompanies } from '@/lib/tenant'
import { getCurrentSuperadmin } from '@/lib/superadmin'
import { LogoutButton } from '@/components/portal/logout-button'

export default async function NoCompanyPage() {
  await requireCompletedUser()

  // If the situation has resolved, route the user where they belong.
  const { isSuperadmin } = await getCurrentSuperadmin()
  if (isSuperadmin) redirect('/superadmin')

  const companies = await getUserCompanies()
  if (companies.length > 0) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">Noch keinem Unternehmen zugeordnet</h1>
          <p className="text-sm text-slate-500">
            Dein Konto ist aktuell keinem Unternehmen zugewiesen. Bitte wende dich an deinen
            Administrator, damit er dich dem richtigen Unternehmen hinzufügt. Danach kannst du dich
            erneut anmelden und siehst dein Dashboard.
          </p>
        </div>
        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
