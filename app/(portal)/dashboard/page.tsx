import { requireCompletedUser } from '@/lib/auth'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function daysUntil(dateString: string | null) {
  if (!dateString) return -999999
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireCompletedUser()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'dein Team'

  const [driversResult, vehiclesResult, docsResult] = await Promise.all([
    supabase.from('drivers').select('*').order('pschein_valid_until', { ascending: true }),
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase.from('compliance_documents').select('*')
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const docs = docsResult.data ?? []

  const driversCount = drivers.length
  const vehiclesCount = vehicles.length
  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'active').length
  const maintenanceVehicles = vehicles.filter((vehicle) => vehicle.status === 'maintenance').length
  const offlineVehicles = vehicles.filter((vehicle) => vehicle.status === 'offline').length

  const criticalDates: { id: string; title: string; days: number }[] = []

  for (const driver of drivers) {
    if (!driver.pschein_valid_until) continue
    const days = daysUntil(driver.pschein_valid_until)
    if (days >= 0 && days < 60) {
      criticalDates.push({
        id: `driver-${driver.id}`,
        title: `P-Schein: ${driver.name}`,
        days,
      })
    }
  }

  for (const doc of docs) {
    if (!doc.due_date) continue
    const days = daysUntil(doc.due_date)
    if (days >= 0 && days < 60) {
      let subject = 'Unbekannt'
      if (doc.scope_type === 'driver') {
        subject = drivers.find(d => d.id === doc.driver_id)?.name || 'Fahrer'
      } else {
        subject = vehicles.find(v => v.id === doc.vehicle_id)?.license_plate || 'Fahrzeug'
      }
      criticalDates.push({
        id: `doc-${doc.id}`,
        title: `${doc.doc_type}: ${subject}`,
        days,
      })
    }
  }

  criticalDates.sort((a, b) => a.days - b.days)

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">Willkommen, {displayName}.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Fahrer gesamt</CardTitle>
            <CardDescription>Aktive Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{driversCount}</p>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Fahrzeuge gesamt</CardTitle>
            <CardDescription>Aktive Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{vehiclesCount}</p>
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Kritische Termine</CardTitle>
            <CardDescription>Fällig in 30 Tagen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{criticalDates.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Flottenstatus</CardTitle>
            <CardDescription>Aktueller Status</CardDescription>
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
            <CardTitle>Kritische Termine</CardTitle>
            <CardDescription>Ablaufdaten (Fahrer & Fahrzeuge)</CardDescription>
          </CardHeader>
          <CardContent>
            {criticalDates.length === 0 ? (
              <p className="text-sm text-slate-500">Keine bevorstehenden Ablaufdaten in den naechsten 30 Tagen.</p>
            ) : (
              <ul className="space-y-2">
                {criticalDates.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-white/70 p-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{item.title}</span>
                    <Badge variant={item.days <= 7 ? 'danger' : 'warning'}>
                      {item.days} Tage
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/schichtplanung" className="surface-card animate-fade-up-delay rounded-xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Disposition</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Schichtplanung</h3>
          <p className="mt-1 text-sm text-slate-600">Schichten planen</p>
        </Link>

        <Link href="/compliance" className="surface-card animate-fade-up-delay-2 rounded-xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fristen</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Compliance-Center</h3>
          <p className="mt-1 text-sm text-slate-600">Dokumente und Fristen</p>
        </Link>

        <Link href="/incidents" className="surface-card animate-fade-up-delay-3 rounded-xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Risikolog</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Incident-Log</h3>
          <p className="mt-1 text-sm text-slate-600">Vorfalle erfassen</p>
        </Link>
      </section>
    </main>
  )
}

