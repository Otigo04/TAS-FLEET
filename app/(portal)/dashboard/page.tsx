import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function daysUntil(dateString: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser()

  const [driversResult, vehiclesResult] = await Promise.all([
    supabase.from('drivers').select('*').order('pschein_valid_until', { ascending: true }),
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []

  const driversCount = drivers.length
  const vehiclesCount = vehicles.length
  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'active').length
  const maintenanceVehicles = vehicles.filter((vehicle) => vehicle.status === 'maintenance').length
  const offlineVehicles = vehicles.filter((vehicle) => vehicle.status === 'offline').length

  const validDrivers = drivers.filter((driver) => daysUntil(driver.pschein_valid_until) >= 0).length
  const expiringSoonDrivers = drivers.filter((driver) => {
    const days = daysUntil(driver.pschein_valid_until)
    return days >= 0 && days <= 30
  })

  const readinessScore = activeVehicles === 0 ? 0 : Math.min(100, Math.round((validDrivers / activeVehicles) * 100))

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">Willkommen zurueck, {user.email}. Hier ist dein aktueller Ueberblick.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="surface-card animate-fade-up-delay transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Fahrer gesamt</CardTitle>
            <CardDescription>Aktive Datensaetze in der Fahrerverwaltung</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{driversCount}</p>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-2 transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Fahrzeuge gesamt</CardTitle>
            <CardDescription>Aktive Datensaetze in der Flotte</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{vehiclesCount}</p>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Uber Readiness</CardTitle>
            <CardDescription>Verhaeltnis verfuegbare Fahrer zu aktiven Fahrzeugen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{readinessScore}%</p>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-2 transition-transform duration-200 hover:-translate-y-1">
          <CardHeader>
            <CardTitle>P-Schein Warnungen</CardTitle>
            <CardDescription>Ablauf innerhalb der naechsten 30 Tage</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{expiringSoonDrivers.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Flottenstatus</CardTitle>
            <CardDescription>Live-Verteilung fuer operative Entscheidungen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 p-3">
              <span>Aktiv</span>
              <Badge variant="success">{activeVehicles}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 p-3">
              <span>Wartung</span>
              <Badge variant="warning">{maintenanceVehicles}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 p-3">
              <span>Offline</span>
              <Badge variant="danger">{offlineVehicles}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Kritische Fahrertermine</CardTitle>
            <CardDescription>Handlungsbedarf fuer Genehmigungen und P-Schein-Verlaengerung</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringSoonDrivers.length === 0 ? (
              <p className="text-sm text-slate-500">Keine bevorstehenden Ablaufdaten in den naechsten 30 Tagen.</p>
            ) : (
              <ul className="space-y-2">
                {expiringSoonDrivers.slice(0, 6).map((driver) => (
                  <li
                    key={driver.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 p-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{driver.name}</span>
                    <Badge variant={daysUntil(driver.pschein_valid_until) <= 7 ? 'danger' : 'warning'}>
                      {daysUntil(driver.pschein_valid_until)} Tage
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/schichtplanung" className="surface-card animate-fade-up-delay rounded-xl p-5 transition-transform hover:-translate-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Disposition</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Schichtplanung</h3>
          <p className="mt-1 text-sm text-slate-600">Fahrer-Zuweisung pro Fahrzeug im Tageskalender.</p>
        </Link>

        <Link href="/compliance" className="surface-card animate-fade-up-delay-2 rounded-xl p-5 transition-transform hover:-translate-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fristen</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Compliance-Center</h3>
          <p className="mt-1 text-sm text-slate-600">P-Schein, HU, Versicherung und Uber-Freigaben verwalten.</p>
        </Link>

        <Link href="/incidents" className="surface-card animate-fade-up-delay-3 rounded-xl p-5 transition-transform hover:-translate-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Risikolog</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Incident-Log</h3>
          <p className="mt-1 text-sm text-slate-600">Schaeden, Bussgelder und Sperrungen mit Status nachhalten.</p>
        </Link>
      </section>
    </main>
  )
}
