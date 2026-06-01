import { requireUser } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const { supabase, user } = await requireUser()

  const [driversResult, vehiclesResult] = await Promise.all([
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }),
  ])

  const driversCount = driversResult.count ?? 0
  const vehiclesCount = vehiclesResult.count ?? 0

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">Willkommen zurueck, {user.email}. Hier ist dein aktueller Ueberblick.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="surface-card transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Fahrer gesamt</CardTitle>
            <CardDescription>Aktive Datensaetze in der Fahrerverwaltung</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{driversCount}</p>
          </CardContent>
        </Card>

        <Card className="surface-card transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Fahrzeuge gesamt</CardTitle>
            <CardDescription>Aktive Datensaetze in der Flotte</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{vehiclesCount}</p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
