import { requireCompletedUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DashboardCharts } from '@/components/portal/dashboard-charts'
import { labelFor } from '@/lib/labels'

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
  const company = await requireActiveCompany()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email || 'dein Team'

  const [driversResult, vehiclesResult, docsResult, incidentsResult] = await Promise.all([
    supabase.from('drivers').select('*').eq('company_id', company.id).order('pschein_valid_until', { ascending: true }),
    supabase.from('vehicles').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
    supabase.from('compliance_documents').select('*').eq('company_id', company.id),
    supabase.from('incidents').select('incident_type').eq('company_id', company.id)
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []
  const docs = docsResult.data ?? []
  const incidents = incidentsResult.data ?? []

  const incidentsByType = Object.entries(
    incidents.reduce<Record<string, number>>((acc, inc) => {
      acc[inc.incident_type] = (acc[inc.incident_type] ?? 0) + 1
      return acc
    }, {}),
  ).map(([type, count]) => ({ label: labelFor(type), count }))

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
        title: `${labelFor(doc.doc_type)}: ${subject}`,
        days,
      })
    }
  }

  criticalDates.sort((a, b) => a.days - b.days)

  return (
    <main className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Willkommen zurück, {displayName}.</p>
        </div>
      </div>

      {/* Kennzahlen-Zeile – kompakt, eine Leiste statt großer Kacheln */}
      <section className="surface-card grid grid-cols-3 divide-x divide-slate-200">
        <Stat label="Fahrer" value={driversCount} hint="aktive Einträge" />
        <Stat label="Fahrzeuge" value={vehiclesCount} hint={`${activeVehicles} aktiv`} />
        <Stat label="Kritische Termine" value={criticalDates.length} hint="nächste 60 Tage" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Flottenstatus */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">Flottenstatus</h2>
            <Link href="/fahrzeuge" className="text-xs font-medium text-brand-700 hover:underline">
              Alle Fahrzeuge
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            <StatusRow label={labelFor('active')} count={activeVehicles} variant="success" />
            <StatusRow label={labelFor('maintenance')} count={maintenanceVehicles} variant="warning" />
            <StatusRow label={labelFor('offline')} count={offlineVehicles} variant="danger" />
          </ul>
        </div>

        {/* Kritische Termine */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">Kritische Termine</h2>
            <Link href="/compliance" className="text-xs font-medium text-brand-700 hover:underline">
              Compliance
            </Link>
          </div>
          {criticalDates.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              Keine Ablaufdaten in den nächsten 60 Tagen.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {criticalDates.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="truncate font-medium text-slate-700">{item.title}</span>
                  <Badge variant={item.days <= 7 ? 'danger' : 'warning'}>{item.days} Tage</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <DashboardCharts
        fleet={{ active: activeVehicles, maintenance: maintenanceVehicles, offline: offlineVehicles }}
        incidentsByType={incidentsByType}
      />

      {/* Schnellzugriff – schlanke Zeilen statt großer Kacheln */}
      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/schichtplanung" label="Schichtplanung" hint="Schichten planen" />
        <QuickLink href="/compliance" label="Compliance-Center" hint="Dokumente & Fristen" />
        <QuickLink href="/incidents" label="Incident-Log" hint="Vorfälle erfassen" />
      </section>
    </main>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

function StatusRow({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: 'success' | 'warning' | 'danger'
}) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-700">{label}</span>
      <Badge variant={variant}>{count}</Badge>
    </li>
  )
}

function QuickLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="surface-card group flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50"
    >
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

