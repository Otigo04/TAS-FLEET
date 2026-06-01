'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

interface VehiclesCrudProps {
  initialVehicles: VehicleRow[]
}

const statuses: VehicleRow['status'][] = ['active', 'maintenance', 'offline']

export function VehiclesCrud({ initialVehicles }: VehiclesCrudProps) {
  const supabase = useMemo(() => createClient(), [])

  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [licensePlate, setLicensePlate] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<VehicleRow['status']>('active')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLicensePlate, setEditLicensePlate] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editStatus, setEditStatus] = useState<VehicleRow['status']>('active')

  async function refreshVehicles() {
    const { data, error: fetchError } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setVehicles(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('vehicles-crud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        void refreshVehicles()
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

    const payload: VehicleInsert = {
      license_plate: licensePlate,
      model,
      status,
    }

    const { error: insertError } = await supabase.from('vehicles').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    setLicensePlate('')
    setModel('')
    setStatus('active')
    setIsBusy(false)
  }

  function startEdit(vehicle: VehicleRow) {
    setEditingId(vehicle.id)
    setEditLicensePlate(vehicle.license_plate)
    setEditModel(vehicle.model)
    setEditStatus(vehicle.status)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(id: string) {
    setIsBusy(true)
    setError(null)

    const payload: VehicleUpdate = {
      license_plate: editLicensePlate,
      model: editModel,
      status: editStatus,
    }

    const { error: updateError } = await supabase.from('vehicles').update(payload).eq('id', id)

    if (updateError) {
      setError(updateError.message)
      setIsBusy(false)
      return
    }

    setEditingId(null)
    setIsBusy(false)
  }

  async function handleDelete(id: string) {
    setIsBusy(true)
    setError(null)

    const { error: deleteError } = await supabase.from('vehicles').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setIsBusy(false)
  }

  return (
    <section className="animate-fade-up-delay grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Neues Fahrzeug anlegen</CardTitle>
          <CardDescription>Kennzeichen, Modell und Status direkt erfassen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-plate">Kennzeichen</Label>
              <Input
                id="vehicle-plate"
                value={licensePlate}
                onChange={(event) => setLicensePlate(event.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-model">Modell</Label>
              <Input id="vehicle-model" value={model} onChange={(event) => setModel(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-status">Status</Label>
              <select
                id="vehicle-status"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={status}
                onChange={(event) => setStatus(event.target.value as VehicleRow['status'])}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              Fahrzeug speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Fahrzeugliste</CardTitle>
          <CardDescription>CRUD mit Realtime. Aenderungen sind sofort fuer alle sichtbar.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="space-y-4">
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Fahrzeuge vorhanden.</p>
            ) : (
              vehicles.map((vehicle) => {
                const isEditing = editingId === vehicle.id

                return (
                  <div
                    key={vehicle.id}
                    className="rounded-lg border border-slate-200/80 bg-white/70 p-4 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          value={editLicensePlate}
                          onChange={(event) => setEditLicensePlate(event.target.value.toUpperCase())}
                        />
                        <Input value={editModel} onChange={(event) => setEditModel(event.target.value)} />
                        <select
                          className="md:col-span-2 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={editStatus}
                          onChange={(event) => setEditStatus(event.target.value as VehicleRow['status'])}
                        >
                          {statuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>

                        <div className="md:col-span-2 flex gap-2">
                          <Button onClick={() => void handleSave(vehicle.id)} disabled={isBusy}>
                            Speichern
                          </Button>
                          <Button variant="secondary" onClick={cancelEdit} disabled={isBusy}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <p className="font-semibold text-slate-900">{vehicle.license_plate}</p>
                          <p className="text-sm text-slate-600">
                            Modell: {vehicle.model} | Status: {vehicle.status}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(vehicle)} disabled={isBusy}>
                            Bearbeiten
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(vehicle.id)}
                            disabled={isBusy}
                          >
                            Loeschen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
