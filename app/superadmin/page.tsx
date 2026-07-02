import { listCompanies, listUsers } from '@/lib/superadmin'
import { SuperadminConsole } from '@/components/superadmin/superadmin-console'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  try {
    const [companies, users] = await Promise.all([listCompanies(), listUsers()])
    return <SuperadminConsole companies={companies} users={users} />
  } catch (err) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">
          Daten konnten nicht geladen werden
        </p>
        <p className="mt-2 text-sm text-slate-200">
          {err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden der Unternehmen/Nutzer.'}
        </p>
      </div>
    )
  }
}
