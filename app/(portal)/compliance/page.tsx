import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { ComplianceCenter } from '@/components/portal/compliance-center'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function daysUntil(dateString: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function CompliancePage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [documentsResult, driversResult, vehiclesResult, settingsResult] = await Promise.all([
    supabase.from('compliance_documents').select('*').eq('company_id', company.id).order('due_date', { ascending: true }),
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name'),
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('license_plate'),
    supabase.from('settings').select('*').eq('company_id', company.id)
  ])

  const documents = documentsResult.data ?? []
  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const settings = settingsResult.data ?? []

  const expired = documents.filter((doc) => daysUntil(doc.due_date) < 0).length
  const expiring = documents.filter((doc) => {
    const days = daysUntil(doc.due_date)
    return days >= 0 && days <= 30
  }).length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dokumenten-Compliance</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Dokumente und Fristen verwalten.</p>
      </div>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Einträge</CardTitle>
            <CardDescription>Dokumente insgesamt</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Bald fällig</CardTitle>
            <CardDescription>Innerhalb 30 Tagen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{expiring}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Überfällig</CardTitle>
            <CardDescription>Fälligkeit überschritten</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{expired}</p>
          </CardContent>
        </Card>
      </section>

      <ComplianceCenter initialDocuments={documents} drivers={drivers} vehicles={vehicles} settings={settings} />
    </main>
  )
}
