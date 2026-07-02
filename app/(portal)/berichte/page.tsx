import { requireCompletedUser } from '@/lib/auth'
import { requireCapability } from '@/lib/tenant'
import { MonthlyReport } from '@/components/portal/monthly-report'

export default async function BerichtePage() {
  const { supabase } = await requireCompletedUser()
  const company = await requireCapability('viewReports')

  const [driversResult, vehiclesResult, incidentsResult, documentsResult, shiftsResult] =
    await Promise.all([
      supabase.from('drivers').select('*').eq('company_id', company.id),
      supabase.from('vehicles').select('*').eq('company_id', company.id),
      supabase.from('incidents').select('*').eq('company_id', company.id),
      supabase.from('compliance_documents').select('*').eq('company_id', company.id),
      supabase.from('shift_assignments').select('*').eq('company_id', company.id),
    ])

  return (
    <main className="space-y-6">
      <div className="animate-fade-up no-print">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Berichte</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Monatsbericht erstellen und als PDF exportieren.</p>
      </div>

      <MonthlyReport
        companyName={company.name}
        companyLogo={company.logoUrl}
        drivers={driversResult.data ?? []}
        vehicles={vehiclesResult.data ?? []}
        incidents={incidentsResult.data ?? []}
        documents={documentsResult.data ?? []}
        shifts={shiftsResult.data ?? []}
      />
    </main>
  )
}
