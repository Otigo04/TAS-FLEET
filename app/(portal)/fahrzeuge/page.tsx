import { requireUser } from '@/lib/auth'
import { VehiclesCrud } from '@/components/portal/vehicles-crud'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FahrzeugePage() {
  const { supabase } = await requireUser()

  const [vehiclesResult, settingsResult] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*')
  ])

  const vehicleRows = vehiclesResult.data ?? []
  const settings = settingsResult.data ?? []
  const active = vehicleRows.filter((vehicle) => vehicle.status === 'active').length
  const maintenance = vehicleRows.filter((vehicle) => vehicle.status === 'maintenance').length
  const offline = vehicleRows.filter((vehicle) => vehicle.status === 'offline').length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fahrzeuge</h1>
        <p className="mt-1 text-slate-600">Flottendaten verwalten.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Gesamt</CardTitle>
            <CardDescription>Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{vehicleRows.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Aktiv</CardTitle>
            <CardDescription>Im Einsatz</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{active}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Wartung</CardTitle>
            <CardDescription>In Wartung</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{maintenance}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Offline</CardTitle>
            <CardDescription>Nicht verfügbar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{offline}</p>
          </CardContent>
        </Card>
      </section>

      <VehiclesCrud initialVehicles={vehicleRows} settings={settings} />
    </main>
  )
}
