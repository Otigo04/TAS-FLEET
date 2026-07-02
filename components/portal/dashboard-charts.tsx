'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface DashboardChartsProps {
  fleet: { active: number; maintenance: number; offline: number }
  incidentsByType: { label: string; count: number }[]
}

const FLEET_COLORS = ['#0891b2', '#d97706', '#e11d48']

export function DashboardCharts({ fleet, incidentsByType }: DashboardChartsProps) {
  const fleetData = [
    { name: 'Aktiv', value: fleet.active },
    { name: 'Wartung', value: fleet.maintenance },
    { name: 'Offline', value: fleet.offline },
  ].filter((d) => d.value > 0)

  const hasFleet = fleetData.length > 0
  const hasIncidents = incidentsByType.some((d) => d.count > 0)

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="surface-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Flottenstatus</h2>
        {hasFleet ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={fleetData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {fleetData.map((_, i) => (
                  <Cell key={i} fill={FLEET_COLORS[i % FLEET_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">Keine Fahrzeugdaten.</p>
        )}
        <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: FLEET_COLORS[0] }} /> Aktiv</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: FLEET_COLORS[1] }} /> Wartung</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: FLEET_COLORS[2] }} /> Offline</span>
        </div>
      </div>

      <div className="surface-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Vorfälle nach Typ</h2>
        {hasIncidents ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={incidentsByType} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-slate-400">Keine Vorfälle erfasst.</p>
        )}
      </div>
    </section>
  )
}
