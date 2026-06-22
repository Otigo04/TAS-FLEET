'use client'

import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { labelFor } from '@/lib/labels'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type IncidentRow = Database['public']['Tables']['incidents']['Row']
type DocRow = Database['public']['Tables']['compliance_documents']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']

interface MonthlyReportProps {
  companyName: string
  companyLogo: string | null
  drivers: DriverRow[]
  vehicles: VehicleRow[]
  incidents: IncidentRow[]
  documents: DocRow[]
  shifts: ShiftRow[]
}

function eur(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function countBy<T>(rows: T[], key: (row: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const k = key(row)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function MonthlyReport({
  companyName,
  companyLogo,
  drivers,
  vehicles,
  incidents,
  documents,
  shifts,
}: MonthlyReportProps) {
  const now = new Date()
  const [month, setMonth] = useState(now.toISOString().slice(0, 7)) // YYYY-MM

  const inMonth = (dateStr: string | null) => Boolean(dateStr) && dateStr!.slice(0, 7) === month

  const data = useMemo(() => {
    const monthIncidents = incidents.filter((i) => inMonth(i.occurred_on))
    const monthShifts = shifts.filter((s) => inMonth(s.shift_date))
    const totalCost = monthIncidents.reduce((sum, i) => sum + (i.cost_eur ?? 0), 0)

    const deadlines: { subject: string; type: string; date: string }[] = []
    for (const d of drivers) {
      if (inMonth(d.pschein_valid_until)) {
        deadlines.push({ subject: d.name, type: 'P-Schein', date: d.pschein_valid_until! })
      }
    }
    for (const doc of documents) {
      if (inMonth(doc.due_date)) {
        const subject =
          doc.scope_type === 'driver'
            ? drivers.find((d) => d.id === doc.driver_id)?.name ?? 'Fahrer'
            : vehicles.find((v) => v.id === doc.vehicle_id)?.license_plate ?? 'Fahrzeug'
        deadlines.push({ subject, type: labelFor(doc.doc_type), date: doc.due_date })
      }
    }
    deadlines.sort((a, b) => a.date.localeCompare(b.date))

    return {
      monthIncidents,
      monthShifts,
      totalCost,
      deadlines,
      incidentsByType: countBy(monthIncidents, (i) => labelFor(i.incident_type)),
      incidentsBySeverity: countBy(monthIncidents, (i) => labelFor(i.severity)),
      shiftsBySlot: countBy(monthShifts, (s) => labelFor(s.shift_slot)),
      activeVehicles: vehicles.filter((v) => v.status === 'active').length,
      maintenanceVehicles: vehicles.filter((v) => v.status === 'maintenance').length,
      offlineVehicles: vehicles.filter((v) => v.status === 'offline').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, incidents, shifts, drivers, documents, vehicles])

  const periodLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })
  const generatedAt = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const kpis = [
    { label: 'Fahrer gesamt', value: drivers.length },
    { label: 'Fahrzeuge gesamt', value: vehicles.length },
    { label: 'Vorfälle im Monat', value: data.monthIncidents.length },
    { label: 'Vorfallskosten', value: eur(data.totalCost) },
    { label: 'Schichten im Monat', value: data.monthShifts.length },
    { label: 'Fristen im Monat', value: data.deadlines.length },
  ]

  return (
    <div className="space-y-6">
      {/* Steuerleiste – wird nicht gedruckt */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label htmlFor="report-month" className="text-sm font-medium text-slate-600">
            Berichtszeitraum
          </label>
          <input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Drucken / Als PDF speichern
        </Button>
      </div>

      {/* Druckbares Dokument */}
      <div className="report-document mx-auto max-w-4xl space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-4">
            {companyLogo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={companyLogo} alt="" className="h-14 w-14 rounded-lg object-contain" />
            ) : null}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{companyName}</h2>
              <p className="text-sm text-slate-500">Monatsbericht · {periodLabel}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold uppercase tracking-[0.2em] text-emerald-600">ORYON FLEET</p>
            <p>Erstellt am {generatedAt}</p>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </section>

        {/* Flottenstatus */}
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Flottenstatus</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{labelFor('active')}</p>
              <p className="text-xl font-bold text-emerald-600">{data.activeVehicles}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{labelFor('maintenance')}</p>
              <p className="text-xl font-bold text-amber-600">{data.maintenanceVehicles}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{labelFor('offline')}</p>
              <p className="text-xl font-bold text-red-600">{data.offlineVehicles}</p>
            </div>
          </div>
        </section>

        {/* Vorfälle */}
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
            Vorfälle im {periodLabel}
          </h3>
          {data.monthIncidents.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Vorfälle in diesem Zeitraum.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ReportTable title="Nach Typ" rows={data.incidentsByType} />
              <ReportTable title="Nach Priorität" rows={data.incidentsBySeverity} />
            </div>
          )}
          <p className="mt-3 text-sm text-slate-700">
            Gesamtkosten: <span className="font-semibold">{eur(data.totalCost)}</span>
          </p>
        </section>

        {/* Schichten */}
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
            Schichtabdeckung im {periodLabel}
          </h3>
          {data.monthShifts.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Schichten in diesem Zeitraum.</p>
          ) : (
            <ReportTable title="Zuweisungen nach Schicht" rows={data.shiftsBySlot} />
          )}
        </section>

        {/* Fristen */}
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
            Ablaufende Fristen im {periodLabel}
          </h3>
          {data.deadlines.length === 0 ? (
            <p className="text-sm text-slate-500">Keine ablaufenden Fristen in diesem Zeitraum.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2">Betrifft</th>
                  <th className="py-2">Typ</th>
                  <th className="py-2 text-right">Fällig am</th>
                </tr>
              </thead>
              <tbody>
                {data.deadlines.map((d, i) => (
                  <tr key={`${d.subject}-${i}`} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{d.subject}</td>
                    <td className="py-2 text-slate-600">{d.type}</td>
                    <td className="py-2 text-right text-slate-600">
                      {new Date(d.date).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Automatisch erstellter Bericht · {companyName} · ORYON FLEET
        </footer>
      </div>
    </div>
  )
}

function ReportTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
