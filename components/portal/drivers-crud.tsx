'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

interface DriversCrudProps {
  initialDrivers: DriverRow[]
}

const shifts = ['Frueh', 'Spaet', 'Nacht']

export function DriversCrud({ initialDrivers }: DriversCrudProps) {
  const supabase = useMemo(() => createClient(), [])

  const [drivers, setDrivers] = useState<DriverRow[]>(initialDrivers)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [pscheinValidUntil, setPscheinValidUntil] = useState('')
  const [district, setDistrict] = useState('')
  const [currentShift, setCurrentShift] = useState(shifts[0])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPscheinValidUntil, setEditPscheinValidUntil] = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const [editCurrentShift, setEditCurrentShift] = useState(shifts[0])

  async function refreshDrivers() {
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setDrivers(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('drivers-crud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        void refreshDrivers()
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

    const payload: DriverInsert = {
      name,
      pschein_valid_until: pscheinValidUntil,
      district,
      current_shift: currentShift,
    }

    const { error: insertError } = await supabase.from('drivers').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    setName('')
    setPscheinValidUntil('')
    setDistrict('')
    setCurrentShift(shifts[0])
    setIsBusy(false)
  }

  function startEdit(driver: DriverRow) {
    setEditingId(driver.id)
    setEditName(driver.name)
    setEditPscheinValidUntil(driver.pschein_valid_until)
    setEditDistrict(driver.district)
    setEditCurrentShift(driver.current_shift)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(id: string) {
    setIsBusy(true)
    setError(null)

    const payload: DriverUpdate = {
      name: editName,
      pschein_valid_until: editPscheinValidUntil,
      district: editDistrict,
      current_shift: editCurrentShift,
    }

    const { error: updateError } = await supabase.from('drivers').update(payload).eq('id', id)

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

    const { error: deleteError } = await supabase.from('drivers').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      setIsBusy(false)
      return
    }

    setIsBusy(false)
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Neuen Fahrer anlegen</CardTitle>
          <CardDescription>Alle Felder sind Pflichtfelder fuer die Disposition.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Name</Label>
              <Input id="driver-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-pschein">P-Schein gueltig bis</Label>
              <Input
                id="driver-pschein"
                type="date"
                value={pscheinValidUntil}
                onChange={(event) => setPscheinValidUntil(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-district">Bezirk</Label>
              <Input
                id="driver-district"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-shift">Schicht</Label>
              <select
                id="driver-shift"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={currentShift}
                onChange={(event) => setCurrentShift(event.target.value)}
              >
                {shifts.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              Fahrer speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fahrerliste</CardTitle>
          <CardDescription>CRUD mit Realtime. Last Write Wins gilt bei gleichzeitigen Aenderungen.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="space-y-4">
            {drivers.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Fahrer vorhanden.</p>
            ) : (
              drivers.map((driver) => {
                const isEditing = editingId === driver.id

                return (
                  <div key={driver.id} className="rounded-lg border border-slate-200 p-4">
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                        <Input
                          type="date"
                          value={editPscheinValidUntil}
                          onChange={(event) => setEditPscheinValidUntil(event.target.value)}
                        />
                        <Input value={editDistrict} onChange={(event) => setEditDistrict(event.target.value)} />
                        <select
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={editCurrentShift}
                          onChange={(event) => setEditCurrentShift(event.target.value)}
                        >
                          {shifts.map((shift) => (
                            <option key={shift} value={shift}>
                              {shift}
                            </option>
                          ))}
                        </select>

                        <div className="md:col-span-2 flex gap-2">
                          <Button onClick={() => void handleSave(driver.id)} disabled={isBusy}>
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
                          <p className="font-semibold text-slate-900">{driver.name}</p>
                          <p className="text-sm text-slate-600">
                            Bezirk: {driver.district} | Schicht: {driver.current_shift}
                          </p>
                          <p className="text-xs text-slate-500">P-Schein bis: {driver.pschein_valid_until}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(driver)} disabled={isBusy}>
                            Bearbeiten
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(driver.id)}
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
