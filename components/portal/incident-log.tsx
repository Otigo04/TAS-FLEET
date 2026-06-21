'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type IncidentRow = Database['public']['Tables']['incidents']['Row']
type IncidentInsert = Database['public']['Tables']['incidents']['Insert']
type SettingsRow = Database['public']['Tables']['settings']['Row']

interface IncidentLogProps {
  initialIncidents: IncidentRow[]
  drivers: DriverRow[]
  vehicles: VehicleRow[]
  settings: SettingsRow[]
}

export function IncidentLog({ initialIncidents, drivers, vehicles, settings }: IncidentLogProps) {
  const supabase = useMemo(() => createClient(), [])

  const incidentTypes = useMemo(() => {
    const s = settings.find(s => s.key === 'incident_types')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['schaeden', 'bussgelder', 'sperrungen']
  }, [settings])

  const severities = useMemo(() => {
    const s = settings.find(s => s.key === 'incident_severities')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['low', 'medium', 'high']
  }, [settings])

  const statuses = useMemo(() => {
    const s = settings.find(s => s.key === 'incident_statuses')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['open', 'in_progress', 'resolved']
  }, [settings])

  const [incidents, setIncidents] = useState<IncidentRow[]>(initialIncidents)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const showBusySpinner = useDelayedLoading(isBusy)

  const [incidentType, setIncidentType] = useState<string>(incidentTypes[0] || 'schaeden')
  const [severity, setSeverity] = useState<string>(severities[0] || 'medium')
  const [status, setStatus] = useState<string>(statuses[0] || 'open')
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10))
  const [driverId, setDriverId] = useState<string>('')
  const [vehicleId, setVehicleId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [costEur, setCostEur] = useState('0')

  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  async function refreshIncidents() {
    const { data, error: fetchError } = await supabase
      .from('incidents')
      .select('*')
      .order('occurred_on', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setIncidents(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('incidents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        void refreshIncidents()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const payload: IncidentInsert = {
      incident_type: incidentType,
      driver_id: driverId || null,
      vehicle_id: vehicleId || null,
      occurred_on: occurredOn,
      severity,
      status,
      description,
      cost_eur: Number(costEur) || 0,
    }

    const { error: insertError } = await supabase.from('incidents').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    setDescription('')
    setCostEur('0')
    setIsBusy(false)
  }

  async function handleStatusUpdate(id: string, nextStatus: string) {
    setError(null)
    const { error: updateError } = await supabase.from('incidents').update({ status: nextStatus }).eq('id', id)

    if (updateError) {
      setError(updateError.message)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    setIsBusy(true)

    const { error: deleteError } = await supabase.from('incidents').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setConfirmDeleteId(null)
    setIsBusy(false)
  }

  function driverName(id: string | null) {
    if (!id) return '-'
    return drivers.find((driver) => driver.id === id)?.name ?? 'Unbekannt'
  }

  function vehicleLabel(id: string | null) {
    if (!id) return '-'
    const vehicle = vehicles.find((entry) => entry.id === id)
    return vehicle ? vehicle.license_plate : 'Unbekannt'
  }

  const filteredIncidents = incidents.filter((incident) => {
    const typeMatch = typeFilter === 'all' || incident.incident_type === typeFilter
    const statusMatch = statusFilter === 'all' || incident.status === statusFilter
    return typeMatch && statusMatch
  })

  function exportToCsv() {
    if (filteredIncidents.length === 0) return

    const headers = ['Datum', 'Typ', 'Priorität', 'Status', 'Fahrer', 'Fahrzeug', 'Kosten EUR', 'Beschreibung']
    const rows = filteredIncidents.map(inc => [
      inc.occurred_on,
      inc.incident_type,
      inc.severity,
      inc.status,
      driverName(inc.driver_id),
      vehicleLabel(inc.vehicle_id),
      inc.cost_eur,
      inc.description
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Incidents_Export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Incident erfassen</CardTitle>
          <CardDescription>Neuer Eintrag</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="incident-type">Typ</Label>
              <select
                id="incident-type"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
              >
                {incidentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-date">Datum</Label>
              <Input id="incident-date" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-severity">Prioritaet</Label>
              <select
                id="incident-severity"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {severities.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-status">Status</Label>
              <select
                id="incident-status"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statuses.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-driver">Fahrer (optional)</Label>
              <select
                id="incident-driver"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">-</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-vehicle">Fahrzeug (optional)</Label>
              <select
                id="incident-vehicle"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">-</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.license_plate}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-cost">Kosten (EUR)</Label>
              <Input id="incident-cost" type="number" step="0.01" min="0" value={costEur} onChange={(e) => setCostEur(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-description">Beschreibung</Label>
              <Input
                id="incident-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurzbeschreibung"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Incident speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader>
          <CardTitle>Incident-Log</CardTitle>
          <CardDescription>Alle Einträge</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Alle Typen</option>
              {incidentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Alle Stati</option>
              {statuses.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {filteredIncidents.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Incidents vorhanden.</p>
          ) : (
            <ul className="space-y-3">
              {filteredIncidents.map((incident) => (
                <li key={incident.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={incident.severity === 'high' ? 'danger' : incident.severity === 'medium' ? 'warning' : 'secondary'}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="secondary">{incident.incident_type}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{incident.description}</p>
                      <p className="text-xs text-slate-500">
                        {incident.occurred_on} · Fahrer: {driverName(incident.driver_id)} · Fahrzeug: {vehicleLabel(incident.vehicle_id)}
                      </p>
                      <p className="text-xs text-slate-500">Kosten: {incident.cost_eur.toFixed(2)} EUR</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        value={incident.status}
                        onChange={(e) => void handleStatusUpdate(incident.id, e.target.value)}
                      >
                        {statuses.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>

                      {confirmDeleteId === incident.id ? (
                        <>
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(incident.id)} disabled={isBusy}>
                            {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Löschen bestätigen
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isBusy}>
                            Abbrechen
                          </Button>
                        </>
                      ) : (
                        <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(incident.id)} disabled={isBusy}>
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
