import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { DispositionPlanner } from '@/components/portal/disposition-planner'
import { resolveShiftSlots } from '@/lib/shifts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function DispositionPage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [driversResult, vehiclesResult, shiftsResult, absencesResult, settingsResult] = await Promise.all([
    supabase.from('drivers').select('*').eq('company_id', company.id).order('name'),
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('license_plate'),
    supabase.from('shift_assignments').select('*').eq('company_id', company.id).order('shift_date', { ascending: true }),
    supabase.from('absences').select('*').eq('company_id', company.id),
    supabase.from('settings').select('*').eq('company_id', company.id).in('key', ['uber_zones', 'shift_names']),
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const shifts = shiftsResult.data ?? []
  const absences = absencesResult.data ?? []
  const settingsRows = settingsResult.data ?? []
  const uberZonesRow = settingsRows.find((r) => r.key === 'uber_zones')
  const uberZones = Array.isArray(uberZonesRow?.value) ? (uberZonesRow!.value as string[]) : []
  const shiftSlots = resolveShiftSlots(settingsRows.find((r) => r.key === 'shift_names')?.value)

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Disposition</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Schichten planen und Fahrer zuteilen.</p>
      </div>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
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

      <DispositionPlanner initialShifts={shifts} drivers={drivers} vehicles={vehicles} absences={absences} uberZones={uberZones} shiftSlots={shiftSlots} />
    </main>
  )
}
