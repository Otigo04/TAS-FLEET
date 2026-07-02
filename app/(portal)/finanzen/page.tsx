import { requireCompletedUser } from '@/lib/auth'
import { requireCapability } from '@/lib/tenant'
import { FinanceManager } from '@/components/portal/finance-manager'

export default async function FinanzenPage() {
  const { supabase } = await requireCompletedUser()
  // Finanzdaten sind sensibel: nur Rollen mit Berichts-Recht (owner/admin).
  const company = await requireCapability('viewReports')

  const [entriesResult, settingsResult] = await Promise.all([
    supabase
      .from('finance_entries')
      .select('*')
      .eq('company_id', company.id)
      .order('entry_date', { ascending: false })
      .limit(2000),
    supabase.from('settings').select('*').eq('company_id', company.id).eq('key', 'finance_config'),
  ])

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Finanzen</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          GuV / EÜR: Gewinnermittlung mit Steuerschätzung (Gewerbesteuer, Körperschaftsteuer, Soli).
        </p>
      </div>

      <FinanceManager
        initialEntries={entriesResult.data ?? []}
        initialSettings={settingsResult.data ?? []}
      />
    </main>
  )
}
