'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Check, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { labelFor } from '@/lib/labels'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type MaintenanceRow = Database['public']['Tables']['vehicle_maintenance']['Row']
type CostRow = Database['public']['Tables']['vehicle_costs']['Row']
type IncidentRow = Database['public']['Tables']['incidents']['Row']

interface VehicleDetailProps {
  vehicle: VehicleRow
  companyId: string
  canEdit: boolean
  incidents: IncidentRow[]
}

const EXTENDED_FIELDS = [
  { key: 'build_year', label: 'Baujahr', type: 'number' },
  { key: 'vin', label: 'FIN / VIN', type: 'text' },
  { key: 'color', label: 'Farbe', type: 'text' },
  { key: 'fuel_type', label: 'Kraftstoff', type: 'text' },
  { key: 'mileage_km', label: 'km-Stand', type: 'number' },
  { key: 'hu_due', label: 'HU/TÜV fällig', type: 'date' },
  { key: 'insurance_company', label: 'Versicherung', type: 'text' },
  { key: 'insurance_number', label: 'Versicherungsnr.', type: 'text' },
  { key: 'insurance_due', label: 'Versicherung fällig', type: 'date' },
  { key: 'purchase_date', label: 'Anschaffung', type: 'date' },
] as const

function eur(n: number) {
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function VehicleDetail({ vehicle, companyId, canEdit, incidents }: VehicleDetailProps) {
  const supabase = useMemo(() => createClient(), [])

  // --- Erweiterte Stammdaten (optional) ---
  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of EXTENDED_FIELDS) {
      const v = vehicle[f.key as keyof VehicleRow]
      initial[f.key] = v == null ? '' : String(v)
    }
    return initial
  })
  const [savingMaster, setSavingMaster] = useState(false)
  const [masterSaved, setMasterSaved] = useState(false)
  const [masterError, setMasterError] = useState<string | null>(null)

  async function saveMaster() {
    setSavingMaster(true)
    setMasterSaved(false)
    setMasterError(null)
    const payload: Database['public']['Tables']['vehicles']['Update'] = {}
    const writable = payload as Record<string, string | number | null>
    for (const f of EXTENDED_FIELDS) {
      const raw = form[f.key]?.trim() ?? ''
      if (f.type === 'number') writable[f.key] = raw === '' ? null : Number(raw)
      else writable[f.key] = raw === '' ? null : raw
    }
    const { error } = await supabase.from('vehicles').update(payload).eq('id', vehicle.id)
    setSavingMaster(false)
    if (error) setMasterError(error.message)
    else {
      setMasterSaved(true)
      setTimeout(() => setMasterSaved(false), 2000)
    }
  }

  // --- Wartung ---
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([])
  const [costs, setCosts] = useState<CostRow[]>([])

  const loadLists = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([
      supabase.from('vehicle_maintenance').select('*').eq('vehicle_id', vehicle.id).order('service_date', { ascending: false }),
      supabase.from('vehicle_costs').select('*').eq('vehicle_id', vehicle.id).order('cost_date', { ascending: false }),
    ])
    setMaintenance(mRes.data ?? [])
    setCosts(cRes.data ?? [])
  }, [supabase, vehicle.id])

  useEffect(() => {
    void loadLists()
    const channel = supabase
      .channel(`vehicle-detail-${vehicle.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_maintenance', filter: `vehicle_id=eq.${vehicle.id}` }, () => void loadLists())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_costs', filter: `vehicle_id=eq.${vehicle.id}` }, () => void loadLists())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, vehicle.id, loadLists])

  const [mDate, setMDate] = useState('')
  const [mType, setMType] = useState('')
  const [mCost, setMCost] = useState('')
  const [mNote, setMNote] = useState('')

  async function addMaintenance() {
    if (!mDate || !mType.trim()) return
    await supabase.from('vehicle_maintenance').insert({
      company_id: companyId,
      vehicle_id: vehicle.id,
      service_date: mDate,
      service_type: mType.trim(),
      cost_eur: mCost ? Number(mCost.replace(',', '.')) : 0,
      note: mNote.trim() || null,
    })
    setMDate(''); setMType(''); setMCost(''); setMNote('')
  }

  const [cDate, setCDate] = useState('')
  const [cCategory, setCCategory] = useState('')
  const [cAmount, setCAmount] = useState('')
  const [cNote, setCNote] = useState('')

  async function addCost() {
    if (!cDate || !cCategory.trim()) return
    await supabase.from('vehicle_costs').insert({
      company_id: companyId,
      vehicle_id: vehicle.id,
      cost_date: cDate,
      category: cCategory.trim(),
      amount_eur: cAmount ? Number(cAmount.replace(',', '.')) : 0,
      note: cNote.trim() || null,
    })
    setCDate(''); setCCategory(''); setCAmount(''); setCNote('')
  }

  const maintenanceTotal = maintenance.reduce((s, m) => s + Number(m.cost_eur ?? 0), 0)
  const costsTotal = costs.reduce((s, c) => s + Number(c.amount_eur ?? 0), 0)
  const damageTotal = incidents.reduce((s, i) => s + Number(i.cost_eur ?? 0), 0)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Erweiterte Stammdaten */}
      <Card className="surface-card lg:col-span-2">
        <CardHeader>
          <CardTitle>Erweiterte Stammdaten <span className="text-sm font-normal text-slate-400">— optional</span></CardTitle>
          <CardDescription>Diese Angaben sind freiwillig und können leer bleiben.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {EXTENDED_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`vf-${f.key}`} className="text-xs text-slate-500 dark:text-slate-400">{f.label}</Label>
                <Input
                  id={`vf-${f.key}`}
                  type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-4 flex items-center gap-3">
              <Button type="button" onClick={() => void saveMaster()} disabled={savingMaster}>
                {savingMaster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : masterSaved ? <Check className="mr-2 h-4 w-4" /> : null}
                {masterSaved ? 'Gespeichert' : 'Speichern'}
              </Button>
              {masterError && <p className="text-sm text-rose-600 dark:text-rose-400">{masterError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wartung */}
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Wartung & Service</CardTitle>
          <CardDescription>Gesamtkosten: {eur(maintenanceTotal)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <div className="grid gap-2 rounded-md border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 p-3 sm:grid-cols-2">
              <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
              <Input placeholder="Art (z. B. Inspektion)" value={mType} onChange={(e) => setMType(e.target.value)} />
              <Input placeholder="Kosten €" inputMode="decimal" value={mCost} onChange={(e) => setMCost(e.target.value)} />
              <Input placeholder="Notiz" value={mNote} onChange={(e) => setMNote(e.target.value)} />
              <Button type="button" size="sm" className="sm:col-span-2" onClick={() => void addMaintenance()} disabled={!mDate || !mType.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Eintrag hinzufügen
              </Button>
            </div>
          )}
          {maintenance.length === 0 ? (
            <p className="text-sm text-slate-400">Keine Wartungseinträge.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700/60 text-sm">
              {maintenance.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700 dark:text-slate-300">{m.service_type}</p>
                    <p className="text-xs text-slate-400">{m.service_date}{m.note ? ` · ${m.note}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">{eur(Number(m.cost_eur ?? 0))}</span>
                    {canEdit && (
                      <button type="button" onClick={() => void supabase.from('vehicle_maintenance').delete().eq('id', m.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Betriebskosten */}
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Betriebskosten</CardTitle>
          <CardDescription>Gesamt: {eur(costsTotal)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <div className="grid gap-2 rounded-md border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 p-3 sm:grid-cols-2">
              <Input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
              <Input placeholder="Kategorie (z. B. Tanken)" value={cCategory} onChange={(e) => setCCategory(e.target.value)} />
              <Input placeholder="Betrag €" inputMode="decimal" value={cAmount} onChange={(e) => setCAmount(e.target.value)} />
              <Input placeholder="Notiz" value={cNote} onChange={(e) => setCNote(e.target.value)} />
              <Button type="button" size="sm" className="sm:col-span-2" onClick={() => void addCost()} disabled={!cDate || !cCategory.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Eintrag hinzufügen
              </Button>
            </div>
          )}
          {costs.length === 0 ? (
            <p className="text-sm text-slate-400">Keine Kosten erfasst.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700/60 text-sm">
              {costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700 dark:text-slate-300">{c.category}</p>
                    <p className="text-xs text-slate-400">{c.cost_date}{c.note ? ` · ${c.note}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">{eur(Number(c.amount_eur ?? 0))}</span>
                    {canEdit && (
                      <button type="button" onClick={() => void supabase.from('vehicle_costs').delete().eq('id', c.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Schadensregister */}
      <Card className="surface-card lg:col-span-2">
        <CardHeader>
          <CardTitle>Schadensregister</CardTitle>
          <CardDescription>Verknüpfte Vorfälle · Gesamtkosten: {eur(damageTotal)}</CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-sm text-slate-400">Keine Vorfälle für dieses Fahrzeug.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700/60 text-sm">
              {incidents.map((inc) => (
                <li key={inc.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700 dark:text-slate-300">{inc.description}</p>
                    <p className="text-xs text-slate-400">{inc.occurred_on} · {labelFor(inc.incident_type)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'secondary'}>
                      {labelFor(inc.severity)}
                    </Badge>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{eur(Number(inc.cost_eur ?? 0))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
