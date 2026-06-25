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
import { Download } from 'lucide-react'
import { useActiveCompanyId, useCan } from '@/components/portal/tenant-provider'
import { AttachmentList } from '@/components/portal/attachments'
import { labelFor } from '@/lib/labels'
import { downloadCsv, todayStamp } from '@/lib/export'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type DocRow = Database['public']['Tables']['compliance_documents']['Row']
type DocInsert = Database['public']['Tables']['compliance_documents']['Insert']
type SettingsRow = Database['public']['Tables']['settings']['Row']

interface ComplianceCenterProps {
  initialDocuments: DocRow[]
  drivers: DriverRow[]
  vehicles: VehicleRow[]
  settings: SettingsRow[]
}

function daysUntil(dateString: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function ComplianceCenter({ initialDocuments, drivers, vehicles, settings }: ComplianceCenterProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const canManage = useCan('manageMasterData')

  const docTypes = useMemo(() => {
    const s = settings.find(s => s.key === 'document_types')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['pschein', 'hu', 'versicherung']
  }, [settings])

  const statuses = useMemo(() => {
    const s = settings.find(s => s.key === 'document_statuses')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['valid', 'expiring', 'expired', 'pending']
  }, [settings])

  const [documents, setDocuments] = useState<DocRow[]>(initialDocuments)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const showBusySpinner = useDelayedLoading(isBusy)

  const [scopeType, setScopeType] = useState<DocRow['scope_type']>('driver')
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '')
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [docType, setDocType] = useState<string>(docTypes[0] || 'pschein')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<string>(statuses[0] || 'pending')
  const [notes, setNotes] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  async function refreshDocuments() {
    const { data, error: fetchError } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setDocuments(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('compliance-docs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compliance_documents' }, () => {
        void refreshDocuments()
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

    const payload: DocInsert = {
      company_id: companyId,
      scope_type: scopeType,
      driver_id: scopeType === 'driver' ? driverId : null,
      vehicle_id: scopeType === 'vehicle' ? vehicleId : null,
      doc_type: docType,
      due_date: dueDate,
      status,
      notes: notes.trim() || null,
    }

    const { error: insertError } = await supabase.from('compliance_documents').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    setNotes('')
    setIsBusy(false)
  }

  async function handleStatusUpdate(id: string, nextStatus: string) {
    setError(null)
    const { error: updateError } = await supabase
      .from('compliance_documents')
      .update({ status: nextStatus })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    setIsBusy(true)

    const { error: deleteError } = await supabase.from('compliance_documents').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setConfirmDeleteId(null)
    setIsBusy(false)
  }

  function subjectLabel(doc: DocRow) {
    if (doc.scope_type === 'driver') {
      return drivers.find((driver) => driver.id === doc.driver_id)?.name ?? 'Fahrer unbekannt'
    }
    const vehicle = vehicles.find((entry) => entry.id === doc.vehicle_id)
    return vehicle ? `${vehicle.license_plate}` : 'Fahrzeug unbekannt'
  }

  const filteredDocuments = documents.filter((doc) => {
    const label = subjectLabel(doc).toLowerCase()
    const term = search.toLowerCase()
    const matchSearch =
      search.trim().length === 0 ||
      label.includes(term) ||
      doc.doc_type.toLowerCase().includes(term) ||
      labelFor(doc.doc_type).toLowerCase().includes(term)
    const matchStatus = statusFilter === 'all' || doc.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <section className={`grid gap-4 sm:gap-6 ${canManage ? 'xl:grid-cols-[380px_1fr]' : ''}`}>
      {canManage && (
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Frist eintragen</CardTitle>
          <CardDescription>Neuer Eintrag</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-scope">Bereich</Label>
              <select
                id="doc-scope"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as DocRow['scope_type'])}
              >
                <option value="driver">Fahrer</option>
                <option value="vehicle">Fahrzeug</option>
              </select>
            </div>

            {scopeType === 'driver' ? (
              <div className="space-y-2">
                <Label htmlFor="doc-driver">Fahrer</Label>
                <select
                  id="doc-driver"
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  required
                >
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="doc-vehicle">Fahrzeug</Label>
                <select
                  id="doc-vehicle"
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  required
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="doc-type">Dokumenttyp</Label>
              <select
                id="doc-type"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {docTypes.map((type) => (
                  <option key={type} value={type}>
                    {labelFor(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-due">Fällig am</Label>
              <Input id="doc-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-status">Status</Label>
              <select
                id="doc-status"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statuses.map((entry) => (
                  <option key={entry} value={entry}>
                    {labelFor(entry)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-notes">Notiz</Label>
              <Input id="doc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Dokument speichern
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Compliance-Center</CardTitle>
            <CardDescription>Alle Einträge</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filteredDocuments.length === 0}
            onClick={() =>
              downloadCsv(
                `compliance-${todayStamp()}`,
                ['Betreff', 'Typ', 'Fällig', 'Status', 'Notiz'],
                filteredDocuments.map((d) => [subjectLabel(d), labelFor(d.doc_type), d.due_date, labelFor(d.status), d.notes ?? '']),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <Input placeholder="Suche Fahrer/Fahrzeug oder Typ" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Alle Status</option>
              {statuses.map((entry) => (
                <option key={entry} value={entry}>
                  {labelFor(entry)}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {filteredDocuments.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Dokumente gefunden.</p>
          ) : (
            <ul className="space-y-3">
              {filteredDocuments.map((doc) => {
                const days = daysUntil(doc.due_date)
                const variant = days < 0 ? 'danger' : days < 60 ? 'warning' : 'success'

                return (
                  <li key={doc.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{subjectLabel(doc)}</p>
                        <p className="text-xs text-slate-500">{labelFor(doc.doc_type)} · Fällig: {doc.due_date}</p>
                        {doc.notes ? <p className="mt-1 text-xs text-slate-600">{doc.notes}</p> : null}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={variant}>{days < 0 ? `${Math.abs(days)} Tage überfällig` : `${days} Tage`}</Badge>
                          <Badge variant="secondary">{labelFor(doc.status)}</Badge>
                        </div>
                      </div>

                      {canManage && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                          value={doc.status}
                          onChange={(e) => void handleStatusUpdate(doc.id, e.target.value)}
                        >
                          {statuses.map((entry) => (
                            <option key={entry} value={entry}>
                              {labelFor(entry)}
                            </option>
                          ))}
                        </select>
                        {confirmDeleteId === doc.id ? (
                          <>
                            <Button variant="destructive" size="sm" onClick={() => void handleDelete(doc.id)} disabled={isBusy}>
                              {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Löschen bestätigen
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isBusy}>
                              Abbrechen
                            </Button>
                          </>
                        ) : (
                          <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(doc.id)} disabled={isBusy}>
                            Löschen
                          </Button>
                        )}
                      </div>
                      )}
                    </div>

                    {companyId && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <AttachmentList
                          companyId={companyId}
                          scopeType="compliance"
                          entityId={doc.id}
                          canEdit={canManage}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
