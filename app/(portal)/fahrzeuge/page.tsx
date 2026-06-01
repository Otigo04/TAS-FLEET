import { requireUser } from '@/lib/auth'
import { VehiclesCrud } from '@/components/portal/vehicles-crud'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FahrzeugePage() {
  const { supabase } = await requireUser()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  const vehicleRows = vehicles ?? []
  const active = vehicleRows.filter((vehicle) => vehicle.status === 'active').length
  const maintenance = vehicleRows.filter((vehicle) => vehicle.status === 'maintenance').length
  const offline = vehicleRows.filter((vehicle) => vehicle.status === 'offline').length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fahrzeuge</h1>
        <p className="mt-1 text-slate-600">Anlegen, bearbeiten und loeschen von Flottendaten.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Gesamt</CardTitle>
            <CardDescription>Erfasste Fahrzeuge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{vehicleRows.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Aktiv</CardTitle>
            <CardDescription>Direkt verfuegbar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{active}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Wartung</CardTitle>
            <CardDescription>Werkstatt oder Check</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{maintenance}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Offline</CardTitle>
            <CardDescription>Aktuell nicht im Einsatz</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{offline}</p>
          </CardContent>
        </Card>
      </section>

      <VehiclesCrud initialVehicles={vehicleRows} />
    </main>
  )
}
