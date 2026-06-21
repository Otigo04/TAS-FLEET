import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { DispositionPlanner } from '@/components/portal/disposition-planner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function DispositionPage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [driversResult, vehiclesResult, shiftsResult] = await Promise.all([
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name'),
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('license_plate'),
    supabase.from('shift_assignments').select('*').eq('company_id', company.id).order('shift_date', { ascending: true }),
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const shifts = shiftsResult.data ?? []

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Disposition</h1>
        <p className="mt-1 text-slate-600">Schichten planen und Fahrer zuteilen.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Geplante Schichten</CardTitle>
            <CardDescription>Gesamt</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{shifts.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Verfügbare Fahrer</CardTitle>
            <CardDescription>Fahrerpool</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{drivers.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Aktive Flotte</CardTitle>
            <CardDescription>Fahrzeuge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{vehicles.length}</p>
          </CardContent>
        </Card>
      </section>

      <DispositionPlanner initialShifts={shifts} drivers={drivers} vehicles={vehicles} />
    </main>
  )
}
