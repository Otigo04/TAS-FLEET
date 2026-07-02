import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { ShiftPlanner } from '@/components/portal/shift-planner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function SchichtplanungPage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [driversResult, shiftsResult] = await Promise.all([
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name'),
    supabase.from('shift_assignments').select('*').eq('company_id', company.id).order('shift_date', { ascending: true }),
  ])

  const drivers = driversResult.data ?? []
  const shifts = shiftsResult.data ?? []

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Schichtzettel / Stundenzettel</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Wöchentliche Arbeitszeiten erfassen und exportieren.</p>
      </div>

      <ShiftPlanner initialShifts={shifts} drivers={drivers} />
    </main>
  )
}
