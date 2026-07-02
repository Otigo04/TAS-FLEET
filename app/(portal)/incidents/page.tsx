import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { IncidentLog } from '@/components/portal/incident-log'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function IncidentsPage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [incidentsResult, driversResult, vehiclesResult, settingsResult] = await Promise.all([
    supabase.from('incidents').select('*').eq('company_id', company.id).order('occurred_on', { ascending: false }),
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name'),
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('license_plate'),
    supabase.from('settings').select('*').eq('company_id', company.id),
  ])

  const incidents = incidentsResult.data ?? []
  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const settings = settingsResult.data ?? []

  const openIncidents = incidents.filter((entry) => entry.status !== 'resolved' && entry.status !== 'closed').length
  const highPriority = incidents.filter((entry) => entry.severity === 'high').length
  const totalCost = incidents.reduce((sum, entry) => sum + entry.cost_eur, 0)

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Incident-Log</h1>
        <p className="mt-1 text-slate-600">Vorfälle dokumentieren.</p>
      </div>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Offene Fälle</CardTitle>
            <CardDescription>Offen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openIncidents}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Hohe Priorität</CardTitle>
            <CardDescription>Priorität hoch</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{highPriority}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Gesamtkosten</CardTitle>
            <CardDescription>Summe</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCost.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </section>

      <IncidentLog initialIncidents={incidents} drivers={drivers} vehicles={vehicles} settings={settings} />
    </main>
  )
}
