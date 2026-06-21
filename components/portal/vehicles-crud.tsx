'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarUploadCrop } from '@/components/ui/avatar-upload-crop'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']
type SettingsRow = Database['public']['Tables']['settings']['Row']

interface VehiclesCrudProps {
  initialVehicles: VehicleRow[]
  settings: SettingsRow[]
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'active') return 'success'
  if (status === 'maintenance') return 'warning'
  if (status === 'offline') return 'danger'
  return 'secondary'
}

export function VehiclesCrud({ initialVehicles, settings }: VehiclesCrudProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()

  const statuses = useMemo(() => {
    const s = settings.find(s => s.key === 'vehicle_statuses')
    if (s && Array.isArray(s.value)) return s.value as string[]
    return ['active', 'maintenance', 'offline']
  }, [settings])

  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [licensePlate, setLicensePlate] = useState('')
  const [model, setModel] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string>(statuses[0] || 'active')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editLicensePlate, setEditLicensePlate] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string>(statuses[0] || 'active')
  const showBusySpinner = useDelayedLoading(isBusy)

  async function refreshVehicles() {
    const { data, error: fetchError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', companyId)
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
      company_id: companyId,
      license_plate: licensePlate,
      model,
      status,
      avatar_url: avatarUrl || null,
    }

    const { error: insertError } = await supabase.from('vehicles').insert(payload)

    if (insertError) {
      setError(insertError.message)
      setIsBusy(false)
      return
    }

    await refreshVehicles()

    setLicensePlate('')
    setModel('')
    setAvatarUrl(null)
    setStatus(statuses[0] || 'active')
    setIsBusy(false)
  }

  function startEdit(vehicle: VehicleRow) {
    setEditingId(vehicle.id)
    setEditLicensePlate(vehicle.license_plate)
    setEditModel(vehicle.model)
    setEditAvatarUrl(vehicle.avatar_url)
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
      avatar_url: editAvatarUrl || null,
    }

    const { error: updateError } = await supabase.from('vehicles').update(payload).eq('id', id)

    if (updateError) {
      setError(updateError.message)
      setIsBusy(false)
      return
    }

    await refreshVehicles()

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

    await refreshVehicles()

    setConfirmDeleteId(null)
    setIsBusy(false)
  }

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchSearch =
      search.trim().length === 0 ||
      vehicle.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || vehicle.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <section className="animate-fade-up-delay grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Neues Fahrzeug anlegen</CardTitle>
          <CardDescription>Neuer Eintrag</CardDescription>
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
              <Label>Fahrzeugbild (optional)</Label>
              <AvatarUploadCrop value={avatarUrl} onChange={setAvatarUrl} placeholder={<Car className="h-6 w-6" />} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-status">Status</Label>
              <select
                id="vehicle-status"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={isBusy}>
              {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Fahrzeug speichern
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Fahrzeugliste</CardTitle>
          <CardDescription>Einträge</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 rounded-lg border border-slate-200/80 bg-white/70 p-3 md:grid-cols-2">
            <Input
              placeholder="Suche Kennzeichen oder Modell"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Alle Status</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

          <div className="space-y-4">
            {filteredVehicles.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Fahrzeuge vorhanden.</p>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isEditing = editingId === vehicle.id

                return (
                  <div
                    key={vehicle.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          value={editLicensePlate}
                          onChange={(event) => setEditLicensePlate(event.target.value.toUpperCase().replace(/[^A-Z0-9\-\s]/g, ''))}
                        />
                        <Input value={editModel} onChange={(event) => setEditModel(event.target.value)} />
                        <div className="flex items-center gap-6">
                          <AvatarUploadCrop value={editAvatarUrl} onChange={setEditAvatarUrl} placeholder={<Car className="h-5 w-5" />} />
                          <span className="text-xs text-slate-500">Fahrzeugbild</span>
                        </div>
                        <select
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={editStatus}
                          onChange={(event) => setEditStatus(event.target.value)}
                        >
                          {statuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>

                        <div className="md:col-span-2 flex gap-2">
                          <Button onClick={() => void handleSave(vehicle.id)} disabled={isBusy}>
                            {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Speichern
                          </Button>
                          <Button variant="secondary" onClick={cancelEdit} disabled={isBusy}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div className="flex items-center gap-4">
                          {vehicle.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={vehicle.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover bg-slate-100 ring-1 ring-slate-200" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                              <Car className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{vehicle.license_plate}</p>
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                              <span>Modell: {vehicle.model}</span>
                              <Badge variant={statusVariant(vehicle.status)}>{vehicle.status}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(vehicle)} disabled={isBusy}>
                            Bearbeiten
                          </Button>
                          {confirmDeleteId === vehicle.id ? (
                            <>
                              <Button variant="destructive" size="sm" onClick={() => void handleDelete(vehicle.id)} disabled={isBusy}>
                                {showBusySpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Löschen bestätigen
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isBusy}>
                                Abbrechen
                              </Button>
                            </>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(vehicle.id)} disabled={isBusy}>
                              Löschen
                            </Button>
                          )}
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
