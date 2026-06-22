'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, CalendarOff, User } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { labelFor } from '@/lib/labels'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type AbsenceRow = Database['public']['Tables']['absences']['Row']
type AbsenceInsert = Database['public']['Tables']['absences']['Insert']
type AbsenceType = AbsenceRow['type']

interface AbsencesManagerProps {
  initialAbsences: AbsenceRow[]
  drivers: DriverRow[]
}

const TYPES: AbsenceType[] = ['urlaub', 'krankheit', 'sonstiges']

function typeVariant(type: AbsenceType): 'secondary' | 'warning' | 'danger' {
  if (type === 'urlaub') return 'secondary'
  if (type === 'krankheit') return 'danger'
  return 'warning'
}

/** Liegt das heutige Datum im (inklusiven) Zeitraum? */
export function isAbsentToday(absence: { start_date: string; end_date: string }): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return absence.start_date <= today && today <= absence.end_date
}

export function AbsencesManager({ initialAbsences, drivers }: AbsencesManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const [absences, setAbsences] = useState<AbsenceRow[]>(initialAbsences)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const showBusySpinner = useDelayedLoading(isBusy)

  const today = new Date().toISOString().slice(0, 10)
  const [driverId, setDriverId] = useState<string>(drivers[0]?.id ?? '')
  const [type, setType] = useState<AbsenceType>('urlaub')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')

  async function refresh() {
    const { data, error: fetchError } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setAbsences(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('absences-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (endDate < startDate) {
      setError('Das Enddatum darf nicht vor dem Startdatum liegen.')
      return
    }
    setIsBusy(true)
    const payload: AbsenceInsert = {
      company_id: companyId,
      driver_id: driverId,
      type,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim() || null,
    }
    const { error: insertError } = await supabase.from('absences').insert(payload)
    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }
    setReason('')
    setIsBusy(false)
  }

  async function handleDelete(id: string) {
    setIsBusy(true)
    setError(null)
    const { error: deleteError } = await supabase.from('absences').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    setConfirmDeleteId(null)
    setIsBusy(false)
  }

  function driverName(id: string) {
    const d = drivers.find((entry) => entry.id === id)
    if (!d) return 'Unbekannt'
    return [d.first_name, d.last_name].filter(Boolean).join(' ') || d.name
  }

  return (
    <section className="grid gap-4 sm:gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Abwesenheit erfassen</CardTitle>
          <CardDescription>Urlaub, Krankheit oder Sonstiges</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="absence-driver">Fahrer</Label>
              <select
                id="absence-driver"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                required
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {[d.first_name, d.last_name].filter(Boolean).join(' ') || d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence-type">Art</Label>
              <select
                id="absence-type"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as AbsenceType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelFor(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="absence-start">Von</Label>
                <Input id="absence-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="absence-end">Bis</Label>
                <Input id="absence-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence-reason">Grund (optional)</Label>
              <Input id="absence-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. Jahresurlaub" />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isBusy || drivers.length === 0}>
              {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Abwesenheit speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader>
          <CardTitle>Abwesenheiten</CardTitle>
          <CardDescription>Alle Einträge (neueste zuerst)</CardDescription>
        </CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Abwesenheiten erfasst.</p>
          ) : (
            <ul className="space-y-3">
              {absences.map((absence) => {
                const active = isAbsentToday(absence)
                return (
                  <li key={absence.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-900">{driverName(absence.driver_id)}</span>
                          <Badge variant={typeVariant(absence.type)}>{labelFor(absence.type)}</Badge>
                          {active ? (
                            <Badge variant="warning" className="gap-1">
                              <CalendarOff className="h-3 w-3" />
                              Aktuell abwesend
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(absence.start_date).toLocaleDateString('de-DE')} – {new Date(absence.end_date).toLocaleDateString('de-DE')}
                          {absence.reason ? ` · ${absence.reason}` : ''}
                        </p>
                      </div>

                      {confirmDeleteId === absence.id ? (
                        <div className="flex items-center gap-2">
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(absence.id)} disabled={isBusy}>
                            {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Löschen bestätigen
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isBusy}>
                            Abbrechen
                          </Button>
                        </div>
                      ) : (
                        <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(absence.id)} disabled={isBusy}>
                          Löschen
                        </Button>
                      )}
                    </div>
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
