'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, User, Car, X } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']
type AbsenceRow = Database['public']['Tables']['absences']['Row']

interface ShiftPlannerProps {
  initialShifts: ShiftRow[]
  drivers: DriverRow[]
  vehicles: VehicleRow[]
  absences: AbsenceRow[]
}

const SHIFT_SLOTS = ['Frueh', 'Spaet', 'Nacht'] as const

function shiftLabel(slot: string) {
  if (slot === 'Frueh') return 'Frühschicht'
  if (slot === 'Spaet') return 'Spätschicht'
  if (slot === 'Nacht') return 'Nachtschicht'
  return slot
}

export function DispositionPlanner({ initialShifts, drivers, vehicles, absences }: ShiftPlannerProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slot, setSlot] = useState<string>('Frueh')

  // Fahrer, die am gewählten Tag abwesend sind (Urlaub/Krankheit), können
  // nicht eingeteilt werden.
  const absentDriverIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of absences) {
      if (a.start_date <= date && date <= a.end_date) ids.add(a.driver_id)
    }
    return ids
  }, [absences, date])
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  }, [supabase])

  const currentShifts = shifts.filter((s) => s.shift_date === date && s.shift_slot === slot)

  async function assignDriver(vehicleId: string, driverId: string) {
    if (!driverId) return
    if (absentDriverIds.has(driverId)) {
      setError('Dieser Fahrer ist am gewählten Tag abwesend und kann nicht eingeteilt werden.')
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
      uber_zone: 'Standard',
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

  return (
    <section className="space-y-6">
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Dispositionsplan</CardTitle>
          <CardDescription>Fahrer zu Fahrzeugen zuweisen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
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
                {SHIFT_SLOTS.map(s => (
                  <option key={s} value={s}>{shiftLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                      disabled={isBusy}
                      value=""
                    >
                      <option value="" disabled>+ Fahrer hinzufügen...</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id} disabled={absentDriverIds.has(d.id)}>
                          {d.name}{absentDriverIds.has(d.id) ? ' — abwesend' : ''}
                        </option>
                      ))}
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
