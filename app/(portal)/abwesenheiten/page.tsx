import { requireCompletedUser } from '@/lib/auth'
import { requireCapability } from '@/lib/tenant'
import { AbsencesManager } from '@/components/portal/absences-manager'

export default async function AbwesenheitenPage() {
  const { supabase } = await requireCompletedUser()
  const company = await requireCapability('manageAbsences')

  const [absencesResult, driversResult] = await Promise.all([
    supabase.from('absences').select('*').eq('company_id', company.id).order('start_date', { ascending: false }),
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name', { ascending: true }),
  ])

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Abwesenheiten</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Urlaub und Krankheit der Fahrer – abwesende Fahrer werden in der Disposition blockiert.</p>
      </div>

      <AbsencesManager initialAbsences={absencesResult.data ?? []} drivers={driversResult.data ?? []} />
    </main>
  )
}
