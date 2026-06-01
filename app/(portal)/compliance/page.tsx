import { requireUser } from '@/lib/auth'
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

  const [documentsResult, driversResult, vehiclesResult] = await Promise.all([
    supabase.from('compliance_documents').select('*').order('due_date', { ascending: true }),
    supabase.from('drivers').select('*').order('name'),
    supabase.from('vehicles').select('*').order('license_plate'),
  ])

  const documents = documentsResult.data ?? []
  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []

  const expired = documents.filter((doc) => daysUntil(doc.due_date) < 0).length
  const expiring = documents.filter((doc) => {
    const days = daysUntil(doc.due_date)
    return days >= 0 && days <= 30
  }).length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dokumenten-Compliance</h1>
        <p className="mt-1 text-slate-600">Fristen fuer P-Schein, HU, Versicherung und Uber-Freigaben zentral steuern.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Eintraege</CardTitle>
            <CardDescription>Dokumente insgesamt</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Bald faellig</CardTitle>
            <CardDescription>Innerhalb 30 Tagen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{expiring}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Ueberfaellig</CardTitle>
            <CardDescription>Sofortiger Handlungsbedarf</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{expired}</p>
          </CardContent>
        </Card>
      </section>

      <ComplianceCenter initialDocuments={documents} drivers={drivers} vehicles={vehicles} />
    </main>
  )
}
