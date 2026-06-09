'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']
type ShiftInsert = Database['public']['Tables']['shift_assignments']['Insert']

interface ShiftPlannerProps {
  initialShifts: ShiftRow[]
  drivers: DriverRow[]
  vehicles: VehicleRow[]
}

const slots: Array<ShiftRow['shift_slot']> = ['Frueh', 'Spaet', 'Nacht']

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export function ShiftPlanner({ initialShifts, drivers, vehicles }: ShiftPlannerProps) {
  const supabase = useMemo(() => createClient(), [])

  const [shifts, setShifts] = useState<ShiftRow[]>(initialShifts)
  const [selectedDay, setSelectedDay] = useState(todayString())
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shiftDate, setShiftDate] = useState(todayString())
  const [slot, setSlot] = useState<ShiftRow['shift_slot']>('Frueh')
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '')
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [uberZone, setUberZone] = useState('Innenstadt')
  const [notes, setNotes] = useState('')

  async function refreshShifts() {
    const { data, error: fetchError } = await supabase
      .from('shift_assignments')
      .select('*')
      .order('shift_date', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setShifts(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('shift-assignments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => {
        void refreshShifts()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setError(null)

    const payload: ShiftInsert = {
      shift_date: shiftDate,
      shift_slot: slot,
      driver_id: driverId,
      vehicle_id: vehicleId,
      uber_zone: uberZone,
      notes: notes.trim() || null,
    }

    const { error: insertError } = await supabase.from('shift_assignments').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    setNotes('')
    setIsBusy(false)
  }

  async function handleDelete(id: string) {
    setIsBusy(true)
    setError(null)

    const { error: deleteError } = await supabase.from('shift_assignments').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setIsBusy(false)
  }

  const filteredShifts = shifts
    .filter((shift) => shift.shift_date === selectedDay)
    .sort((a, b) => slots.indexOf(a.shift_slot) - slots.indexOf(b.shift_slot))

  function driverName(id: string) {
    return drivers.find((driver) => driver.id === id)?.name ?? 'Unbekannt'
  }

  function vehicleLabel(id: string) {
    const vehicle = vehicles.find((entry) => entry.id === id)
    if (!vehicle) return 'Unbekannt'
    return `${vehicle.license_plate} (${vehicle.model})`
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="surface-card animate-fade-up-delay">
        <CardHeader>
          <CardTitle>Schicht zuweisen</CardTitle>
          <CardDescription>Neue Zuweisung</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift-date">Datum</Label>
              <Input id="shift-date" type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-slot">Schicht</Label>
              <select
                id="shift-slot"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={slot}
                onChange={(e) => setSlot(e.target.value as ShiftRow['shift_slot'])}
              >
                {slots.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-driver">Fahrer</Label>
              <select
                id="shift-driver"
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

            <div className="space-y-2">
              <Label htmlFor="shift-vehicle">Fahrzeug</Label>
              <select
                id="shift-vehicle"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.license_plate} ({vehicle.model})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-zone">Uber Zone</Label>
              <Input id="shift-zone" value={uberZone} onChange={(e) => setUberZone(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift-note">Notiz</Label>
              <Input id="shift-note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>

            <Button type="submit" className="w-full" disabled={isBusy || !driverId || !vehicleId}>
              Zuweisung speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader>
          <CardTitle>Tageskalender</CardTitle>
          <CardDescription>Zuweisungen pro Tag</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Label htmlFor="calendar-day" className="whitespace-nowrap">
              Kalendertag
            </Label>
            <Input id="calendar-day" type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
          </div>

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {filteredShifts.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Schichtzuweisungen fuer diesen Tag.</p>
          ) : (
            <ul className="space-y-3">
              {filteredShifts.map((shift) => (
                <li key={shift.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{shift.shift_slot}</Badge>
                        <span className="text-sm text-slate-600">Zone: {shift.uber_zone}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{driverName(shift.driver_id)}</p>
                      <p className="text-sm text-slate-600">{vehicleLabel(shift.vehicle_id)}</p>
                      {shift.notes ? <p className="mt-1 text-xs text-slate-500">{shift.notes}</p> : null}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete(shift.id)} disabled={isBusy}>
                      Loeschen
                    </Button>
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
