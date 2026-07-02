'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, User, Car, X, FileDown, Copy, CalendarRange } from 'lucide-react'
// pdf-lib wird erst beim PDF-Export dynamisch geladen (kleineres Initial-Bundle).
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'

function addDaysIso(iso: string, delta: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function startOfWeekIso(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDay() || 7 // Mo=1..So=7
  return addDaysIso(iso, 1 - day)
}

function safePdf(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']
type AbsenceRow = Database['public']['Tables']['absences']['Row']

interface ShiftPlannerProps {
  initialShifts: ShiftRow[]
  drivers: DriverRow[]
  vehicles: VehicleRow[]
  absences: AbsenceRow[]
  uberZones: string[]
}

const SHIFT_SLOTS = ['Frueh', 'Spaet', 'Nacht'] as const
/** Filterwert für "alle Schichten anzeigen" — kein DB-Code, nur UI-Zustand. */
const ALL_SLOTS = 'alle'

function shiftLabel(slot: string) {
  if (slot === 'Frueh') return 'Frühschicht'
  if (slot === 'Spaet') return 'Spätschicht'
  if (slot === 'Nacht') return 'Nachtschicht'
  if (slot === ALL_SLOTS) return 'Alle Schichten'
  return slot
}

export function DispositionPlanner({ initialShifts, drivers, vehicles, absences, uberZones }: ShiftPlannerProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slot, setSlot] = useState<string>(ALL_SLOTS)
  const showAllSlots = slot === ALL_SLOTS
  const [zone, setZone] = useState<string>(uberZones[0] ?? 'Standard')

  // Fahrer, die am gewählten Tag abwesend sind (Urlaub/Krankheit), können
  // nicht eingeteilt werden.
  const absentDriverIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of absences) {
      if (a.start_date <= date && date <= a.end_date) ids.add(a.driver_id)
    }
    return ids
  }, [absences, date])

  // Fahrer mit am gewählten Tag bereits abgelaufenem P-Schein -> Konflikt.
  const expiredPscheinIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of drivers) {
      if (d.pschein_valid_until && d.pschein_valid_until < date) ids.add(d.id)
    }
    return ids
  }, [drivers, date])
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWeek, setShowWeek] = useState(false)
  const [copyTarget, setCopyTarget] = useState(() => addDaysIso(new Date().toISOString().slice(0, 10), 1))
  const [pdfBusy, setPdfBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function refreshShifts() {
    const { data, error: fetchError } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('company_id', companyId)
      .order('shift_date', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setShifts(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('shifts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => {
        void refreshShifts()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId])

  const currentShifts = shifts.filter(
    (s) => s.shift_date === date && (showAllSlots || s.shift_slot === slot),
  )

  async function assignDriver(vehicleId: string, driverId: string) {
    if (!driverId) return
    if (absentDriverIds.has(driverId)) {
      setError('Dieser Fahrer ist am gewählten Tag abwesend und kann nicht eingeteilt werden.')
      return
    }
    if (expiredPscheinIds.has(driverId)) {
      setError('P-Schein dieses Fahrers ist abgelaufen — Einteilung nicht möglich.')
      return
    }
    setIsBusy(true)
    setError(null)

    if (currentShifts.some(s => s.vehicle_id === vehicleId && s.driver_id === driverId)) {
      setIsBusy(false)
      return
    }

    const { error: insertError } = await supabase.from('shift_assignments').insert({
      company_id: companyId,
      shift_date: date,
      shift_slot: slot as 'Frueh' | 'Spaet' | 'Nacht',
      vehicle_id: vehicleId,
      driver_id: driverId,
      uber_zone: zone || 'Standard',
    })

    if (insertError) {
      setError(insertError.message)
    }
    setIsBusy(false)
  }

  async function unassignDriver(assignmentId: string) {
    setIsBusy(true)
    setError(null)

    const { error: deleteError } = await supabase.from('shift_assignments').delete().eq('id', assignmentId)

    if (deleteError) {
      setError(deleteError.message)
    }
    setIsBusy(false)
  }

  const activeVehicles = vehicles.filter(v => v.status === 'active')

  // Mo–So der Woche, in der das gewählte Datum liegt (für die Wochenübersicht).
  const weekDays = useMemo(() => {
    const start = startOfWeekIso(date)
    return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i))
  }, [date])

  function driverName(id: string) {
    return drivers.find(d => d.id === id)?.name ?? 'Unbekannt'
  }
  function vehiclePlate(id: string) {
    return vehicles.find(v => v.id === id)?.license_plate ?? '—'
  }

  // Kopiert alle Zuweisungen des gewählten Tages auf ein Zieldatum (gleiche
  // Slots/Zonen). Duplikate werden durch die DB-Constraints übersprungen.
  async function handleCopyDay() {
    setInfo(null)
    setError(null)
    const dayShifts = shifts.filter(s => s.shift_date === date)
    if (dayShifts.length === 0) {
      setError('Für den gewählten Tag gibt es keine Zuweisungen zum Kopieren.')
      return
    }
    setIsBusy(true)
    let copied = 0
    for (const s of dayShifts) {
      const { error: insErr } = await supabase.from('shift_assignments').insert({
        company_id: companyId,
        shift_date: copyTarget,
        shift_slot: s.shift_slot,
        vehicle_id: s.vehicle_id,
        driver_id: s.driver_id,
        uber_zone: s.uber_zone,
      })
      if (!insErr) copied += 1
    }
    setIsBusy(false)
    setInfo(`${copied} Zuweisung(en) auf ${copyTarget} kopiert${copied < dayShifts.length ? ' (Duplikate übersprungen)' : ''}.`)
  }

  async function handleDayPdf() {
    setPdfBusy(true)
    setError(null)
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([595, 842])
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
      const reg = await pdf.embedFont(StandardFonts.Helvetica)

      page.drawText('Dienstplan', { x: 40, y: 800, size: 22, font: bold, color: rgb(0.1, 0.12, 0.16) })
      page.drawText(`Datum: ${date}`, { x: 40, y: 778, size: 11, font: reg, color: rgb(0.3, 0.34, 0.4) })

      let y = 745
      for (const slotName of SHIFT_SLOTS) {
        const slotShifts = shifts.filter(s => s.shift_date === date && s.shift_slot === slotName)
        page.drawText(shiftLabel(slotName), { x: 40, y, size: 13, font: bold, color: rgb(0.12, 0.4, 0.27) })
        y -= 18
        if (slotShifts.length === 0) {
          page.drawText('—', { x: 52, y, size: 10, font: reg, color: rgb(0.5, 0.55, 0.6) })
          y -= 18
        } else {
          for (const s of slotShifts) {
            const line = `${vehiclePlate(s.vehicle_id)}   ${safePdf(driverName(s.driver_id))}   (${safePdf(s.uber_zone)})`
            page.drawText(line, { x: 52, y, size: 10, font: reg, color: rgb(0.2, 0.23, 0.28) })
            y -= 16
            if (y < 60) { y = 800; pdf.addPage([595, 842]) }
          }
        }
        y -= 10
      }

      const bytes = await pdf.save()
      const buffer = new ArrayBuffer(bytes.length)
      new Uint8Array(buffer).set(bytes)
      const blob = new Blob([buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dienstplan-${date}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF konnte nicht erstellt werden.')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Dispositionsplan</CardTitle>
          <CardDescription>Fahrer zu Fahrzeugen zuweisen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mb-6 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="space-y-1.5">
              <Label htmlFor="shift-date">Datum</Label>
              <Input id="shift-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-slot">Schicht</Label>
              <select
                id="shift-slot"
                className="flex h-10 min-w-[160px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={slot}
                onChange={e => setSlot(e.target.value)}
              >
                <option value={ALL_SLOTS}>{shiftLabel(ALL_SLOTS)}</option>
                {SHIFT_SLOTS.map(s => (
                  <option key={s} value={s}>{shiftLabel(s)}</option>
                ))}
              </select>
            </div>
            {uberZones.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="shift-zone">Zone</Label>
                <select
                  id="shift-zone"
                  className="flex h-10 min-w-[160px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={zone}
                  onChange={e => setZone(e.target.value)}
                >
                  {uberZones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error ? <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</p> : null}
          {info ? <p className="mb-4 text-sm text-brand-700 bg-brand-50 p-3 rounded border border-brand-200">{info}</p> : null}

          {/* Werkzeuge: PDF-Aushang, Tag kopieren, Wochenübersicht */}
          <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleDayPdf()} disabled={pdfBusy}>
              {pdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Dienstplan (PDF)
            </Button>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="copy-target" className="text-xs text-slate-500">Tag kopieren nach</Label>
                <Input id="copy-target" type="date" value={copyTarget} onChange={e => setCopyTarget(e.target.value)} className="w-40" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyDay()} disabled={isBusy}>
                <Copy className="mr-2 h-4 w-4" /> Kopieren
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowWeek(v => !v)}>
              <CalendarRange className="mr-2 h-4 w-4" /> {showWeek ? 'Wochenübersicht ausblenden' : 'Wochenübersicht'}
            </Button>
          </div>

          {showWeek && (
            <div className="mb-6 overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-7 gap-2">
                {weekDays.map(d => {
                  const dayShifts = shifts.filter(s => s.shift_date === d)
                  const isSelected = d === date
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setDate(d)}
                      className={`rounded-md border p-2 text-left transition-colors ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <p className="text-xs font-semibold text-slate-700">
                        {new Date(`${d}T00:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{dayShifts.length}</p>
                      <p className="text-[11px] text-slate-400">Zuweisungen</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeVehicles.map(vehicle => {
              const assigned = currentShifts.filter(s => s.vehicle_id === vehicle.id)
              const assignedDriverIds = assigned.map(s => s.driver_id)
              const availableDrivers = drivers.filter(d => !assignedDriverIds.includes(d.id))

              return (
                <div key={vehicle.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {vehicle.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={vehicle.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-500 ring-1 ring-slate-200/50">
                          <Car className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 leading-tight">{vehicle.license_plate}</h4>
                        <p className="text-xs text-slate-500">{vehicle.model}</p>
                      </div>
                    </div>
                    <Badge variant={assigned.length > 0 ? "success" : "secondary"}>{assigned.length} Fahrer</Badge>
                  </div>

                  <div className="p-4 flex-1 space-y-3 bg-white">
                    {assigned.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Keine Fahrer zugewiesen.</p>
                    ) : (
                      <ul className="space-y-2">
                        {assigned.map(assignment => {
                          const driver = drivers.find(d => d.id === assignment.driver_id)
                          return (
                            <li key={assignment.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                {driver?.avatar_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={driver.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" />
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 ring-1 ring-slate-200">
                                    <User className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                <span className="font-medium text-slate-700">{driver?.name ?? 'Unbekannt'}</span>
                                {showAllSlots && (
                                  <Badge variant="secondary">{shiftLabel(assignment.shift_slot)}</Badge>
                                )}
                                {assignment.uber_zone && assignment.uber_zone !== 'Standard' ? (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{assignment.uber_zone}</span>
                                ) : null}
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => void unassignDriver(assignment.id)} disabled={isBusy}>
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      onChange={e => {
                        void assignDriver(vehicle.id, e.target.value)
                        e.target.value = ''
                      }}
                      disabled={isBusy || showAllSlots}
                      title={showAllSlots ? 'Zum Zuweisen zuerst eine konkrete Schicht wählen' : undefined}
                      value=""
                    >
                      <option value="" disabled>
                        {showAllSlots ? 'Zum Zuweisen Schicht wählen…' : '+ Fahrer hinzufügen...'}
                      </option>
                      {availableDrivers.map(d => {
                        const absent = absentDriverIds.has(d.id)
                        const expired = expiredPscheinIds.has(d.id)
                        const suffix = absent ? ' — abwesend' : expired ? ' — P-Schein abgelaufen' : ''
                        return (
                          <option key={d.id} value={d.id} disabled={absent || expired}>
                            {d.name}{suffix}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
