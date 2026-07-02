import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { VehiclesCrud } from '@/components/portal/vehicles-crud'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FahrzeugePage() {
  const { supabase } = await requireUser()
  const company = await requireActiveCompany()

  const [vehiclesResult, settingsResult] = await Promise.all([
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('company_id', company.id)
  ])

  const vehicleRows = vehiclesResult.data ?? []
  const settings = settingsResult.data ?? []
  const active = vehicleRows.filter((vehicle) => vehicle.status === 'active').length
  const maintenance = vehicleRows.filter((vehicle) => vehicle.status === 'maintenance').length
  const offline = vehicleRows.filter((vehicle) => vehicle.status === 'offline').length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Fahrzeuge</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Flottendaten verwalten.</p>
      </div>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Gesamt</CardTitle>
            <CardDescription>Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{vehicleRows.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Aktiv</CardTitle>
            <CardDescription>Im Einsatz</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{active}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Wartung</CardTitle>
            <CardDescription>In Wartung</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{maintenance}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Offline</CardTitle>
            <CardDescription>Nicht verfügbar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{offline}</p>
          </CardContent>
        </Card>
      </section>

      <VehiclesCrud initialVehicles={vehicleRows} settings={settings} />
    </main>
  )
}
