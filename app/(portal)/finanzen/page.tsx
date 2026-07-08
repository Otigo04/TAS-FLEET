import { requireCompletedUser } from '@/lib/auth'
import { requireCapability } from '@/lib/tenant'
import { FinanceWorkspace } from '@/components/portal/finance-workspace'

export default async function FinanzenPage() {
  const { supabase } = await requireCompletedUser()
  // Finanzdaten sind sensibel: nur Rollen mit Berichts-Recht (owner/admin).
  const company = await requireCapability('viewReports')

  const [entriesResult, settingsResult, vehiclesResult] = await Promise.all([
    supabase
      .from('finance_entries')
      .select('*')
      .eq('company_id', company.id)
      .order('entry_date', { ascending: false })
      .limit(2000),
    supabase
      .from('settings')
      .select('*')
      .eq('company_id', company.id)
      .in('key', ['finance_config', 'fuel_ratio_config']),
    supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', company.id)
      .order('license_plate', { ascending: true }),
  ])

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Finanzen</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          GuV / EÜR mit Steuerschätzung und Tank-zu-Umsatz-Auswertung je Fahrzeug.
        </p>
      </div>

      <FinanceWorkspace
        initialEntries={entriesResult.data ?? []}
        initialSettings={settingsResult.data ?? []}
        initialVehicles={vehiclesResult.data ?? []}
      />
    </main>
  )
}
