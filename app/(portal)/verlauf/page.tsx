import { requireCompletedUser } from '@/lib/auth'
import { requireCapability } from '@/lib/tenant'
import { AuditLogView } from '@/components/portal/audit-log-view'

export default async function VerlaufPage() {
  const { supabase } = await requireCompletedUser()
  const company = await requireCapability('viewAudit')

  const { data: entries } = await supabase
    .from('audit_log')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Verlauf</h1>
        <p className="mt-1 text-slate-600">Lückenlose Änderungshistorie aller Stamm- und Bewegungsdaten.</p>
      </div>

      <AuditLogView initialEntries={entries ?? []} />
    </main>
  )
}
