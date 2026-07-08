'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Droplet, Euro, FileDown, Fuel, Loader2, Percent, Plus, Trash2, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { LoadingScreen } from '@/components/portal/loading-screen'
import { useActiveCompanyId, useCan, useTenant } from '@/components/portal/tenant-provider'
import { formatEur } from '@/lib/taxes'
import { downloadCsv, todayStamp } from '@/lib/export'
import { cn } from '@/lib/utils'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type CostRow = Database['public']['Tables']['vehicle_costs']['Row']
type RevenueRow = Database['public']['Tables']['vehicle_revenue']['Row']
type SettingsRow = Database['public']['Tables']['settings']['Row']

type Period = 'monat' | 'jahr'
type EntryKind = 'umsatz' | 'tank'

// Standard-Schwellwerte der Tank/Umsatz-Ampel (in Prozent). Ein guter
// Kraftstoffanteil am Umsatz liegt erfahrungsgemäß deutlich unter 25 %.
const DEFAULT_WARN = 25
const DEFAULT_CRIT = 35

interface RatioConfig {
  warn: number
  crit: number
}

function parseRatioConfig(settings: SettingsRow[]): RatioConfig {
  const row = settings.find((s) => s.key === 'fuel_ratio_config')
  const v = (row?.value ?? {}) as Partial<RatioConfig>
  return {
    warn: typeof v.warn === 'number' && v.warn > 0 ? v.warn : DEFAULT_WARN,
    crit: typeof v.crit === 'number' && v.crit > 0 ? v.crit : DEFAULT_CRIT,
  }
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

/** Ampel-Einstufung: null = kein Umsatz (Ratio nicht berechenbar). */
function ratioLevel(ratio: number | null, cfg: RatioConfig): 'none' | 'good' | 'warn' | 'crit' {
  if (ratio === null) return 'none'
  if (ratio > cfg.crit) return 'crit'
  if (ratio > cfg.warn) return 'warn'
  return 'good'
}

interface VehicleStat {
  vehicle: VehicleRow
  revenue: number
  fuel: number
  ratio: number | null
}

interface FuelRatioManagerProps {
  initialVehicles: VehicleRow[]
  initialSettings: SettingsRow[]
}

export function FuelRatioManager({
  initialVehicles, initialSettings,
}: FuelRatioManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const { activeCompany } = useTenant()
  const canManageSettings = useCan('manageSettings')

  const [vehicles] = useState<VehicleRow[]>(initialVehicles)
  const [fuelCosts, setFuelCosts] = useState<CostRow[]>([])
  const [revenue, setRevenue] = useState<RevenueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const showBusy = useDelayedLoading(isBusy)

  // ── Zeitraum ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>('monat')
  const [month, setMonth] = useState(currentMonthValue())
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const prefix = period === 'monat' ? month : year
  const isMonat = period === 'monat'

  // ── Ampel-Konfiguration ───────────────────────────────────────────
  const [config, setConfig] = useState<RatioConfig>(() => parseRatioConfig(initialSettings))
  const [configSaved, setConfigSaved] = useState(false)

  async function saveConfig(next: RatioConfig) {
    setConfig(next)
    setConfigSaved(false)
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert(
        { company_id: companyId, key: 'fuel_ratio_config', value: next as unknown as SettingsRow['value'] },
        { onConflict: 'company_id,key' },
      )
    if (upsertError) setError(upsertError.message)
    else {
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 2500)
    }
  }

  // ── Daten laden / Realtime ────────────────────────────────────────
  async function refresh() {
    const [costsRes, revRes] = await Promise.all([
      supabase.from('vehicle_costs').select('*').eq('company_id', companyId).eq('cost_type', 'tank'),
      supabase.from('vehicle_revenue').select('*').eq('company_id', companyId),
    ])
    if (costsRes.error) { setError(costsRes.error.message); return }
    if (revRes.error) { setError(revRes.error.message); return }
    setFuelCosts(costsRes.data ?? [])
    setRevenue(revRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    const channel = supabase
      .channel('fuel-ratio-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_costs' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_revenue' }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId])

  // ── Auswertung je Fahrzeug ────────────────────────────────────────
  const stats: VehicleStat[] = useMemo(() => {
    const revByVehicle = new Map<string, number>()
    for (const r of revenue) {
      if (!r.revenue_date.startsWith(prefix)) continue
      revByVehicle.set(r.vehicle_id, (revByVehicle.get(r.vehicle_id) ?? 0) + Number(r.amount_eur))
    }
    const fuelByVehicle = new Map<string, number>()
    for (const c of fuelCosts) {
      if (!c.cost_date.startsWith(prefix)) continue
      fuelByVehicle.set(c.vehicle_id, (fuelByVehicle.get(c.vehicle_id) ?? 0) + Number(c.amount_eur))
    }
    return vehicles
      .map((vehicle) => {
        const rev = revByVehicle.get(vehicle.id) ?? 0
        const fuel = fuelByVehicle.get(vehicle.id) ?? 0
        const ratio = rev > 0 ? (fuel / rev) * 100 : null
        return { vehicle, revenue: rev, fuel, ratio }
      })
      // Fahrzeuge ohne jede Buchung im Zeitraum ausblenden.
      .filter((s) => s.revenue > 0 || s.fuel > 0)
      .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))
  }, [vehicles, revenue, fuelCosts, prefix])

  const totalRevenue = stats.reduce((s, v) => s + v.revenue, 0)
  const totalFuel = stats.reduce((s, v) => s + v.fuel, 0)
  const totalRatio = totalRevenue > 0 ? (totalFuel / totalRevenue) * 100 : null

  const periodLabel = isMonat
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : `Jahr ${year}`

  // ── Formular ──────────────────────────────────────────────────────
  const [formKind, setFormKind] = useState<EntryKind>('umsatz')
  const [formVehicle, setFormVehicle] = useState('')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formAmount, setFormAmount] = useState('')
  const [formNote, setFormNote] = useState('')

  const vehicleOptions = useMemo(
    () => vehicles.map((v) => ({ value: v.id, label: `${v.license_plate} · ${v.model}` })),
    [vehicles],
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!formVehicle) { setError('Bitte ein Fahrzeug wählen.'); return }
    const amount = Number(formAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Bitte einen gültigen Betrag größer 0 eingeben.')
      return
    }
    setIsBusy(true)
    setError(null)
    const rounded = Math.round(amount * 100) / 100
    const insertError = formKind === 'umsatz'
      ? (await supabase.from('vehicle_revenue').insert({
          company_id: companyId,
          vehicle_id: formVehicle,
          revenue_date: formDate,
          amount_eur: rounded,
          note: formNote.trim() || null,
        })).error
      : (await supabase.from('vehicle_costs').insert({
          company_id: companyId,
          vehicle_id: formVehicle,
          cost_date: formDate,
          category: 'Tanken',
          cost_type: 'tank',
          amount_eur: rounded,
          note: formNote.trim() || null,
        })).error
    if (insertError) setError(insertError.message)
    else {
      setFormAmount('')
      setFormNote('')
      await refresh()
    }
    setIsBusy(false)
  }

  async function handleDeleteRevenue(id: string) {
    setIsBusy(true); setError(null)
    const { error: e } = await supabase.from('vehicle_revenue').delete().eq('id', id)
    if (e) setError(e.message); else await refresh()
    setIsBusy(false)
  }

  async function handleDeleteFuel(id: string) {
    setIsBusy(true); setError(null)
    const { error: e } = await supabase.from('vehicle_costs').delete().eq('id', id)
    if (e) setError(e.message); else await refresh()
    setIsBusy(false)
  }

  // Letzte Buchungen im Zeitraum (für die Lösch-Liste).
  const recentEntries = useMemo(() => {
    const plate = (id: string) => vehicles.find((v) => v.id === id)?.license_plate ?? '—'
    const rev = revenue
      .filter((r) => r.revenue_date.startsWith(prefix))
      .map((r) => ({ id: r.id, kind: 'umsatz' as const, date: r.revenue_date, plate: plate(r.vehicle_id), amount: Number(r.amount_eur), note: r.note }))
    const fuel = fuelCosts
      .filter((c) => c.cost_date.startsWith(prefix))
      .map((c) => ({ id: c.id, kind: 'tank' as const, date: c.cost_date, plate: plate(c.vehicle_id), amount: Number(c.amount_eur), note: c.note }))
    return [...rev, ...fuel].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
  }, [revenue, fuelCosts, prefix, vehicles])

  // ── CSV-Export ────────────────────────────────────────────────────
  function handleExportCsv() {
    const rows = stats.map((s) => [
      s.vehicle.license_plate,
      s.vehicle.model,
      s.revenue.toFixed(2).replace('.', ','),
      s.fuel.toFixed(2).replace('.', ','),
      s.ratio === null ? '' : s.ratio.toFixed(1).replace('.', ','),
    ])
    rows.push([
      'GESAMT', '',
      totalRevenue.toFixed(2).replace('.', ','),
      totalFuel.toFixed(2).replace('.', ','),
      totalRatio === null ? '' : totalRatio.toFixed(1).replace('.', ','),
    ])
    downloadCsv(
      `tank-umsatz-${prefix}-${todayStamp()}`,
      ['Kennzeichen', 'Modell', 'Umsatz (EUR)', 'Tankkosten (EUR)', 'Ratio (%)'],
      rows,
    )
  }

  // ── PDF / Druck ───────────────────────────────────────────────────
  function handleExportPdf() {
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
    const pct = (r: number | null) => (r === null ? '—' : `${r.toFixed(1).replace('.', ',')} %`)
    const cls = (r: number | null) => {
      const lvl = ratioLevel(r, config)
      return lvl === 'crit' ? 'neg' : lvl === 'warn' ? 'warnc' : lvl === 'good' ? 'pos' : 'muted'
    }

    const bodyRows = stats.map((s) => `<tr>
      <td>${esc(s.vehicle.license_plate)}</td>
      <td>${esc(s.vehicle.model)}</td>
      <td class="num">${esc(formatEur(s.revenue))}</td>
      <td class="num">${esc(formatEur(s.fuel))}</td>
      <td class="num ${cls(s.ratio)}">${esc(pct(s.ratio))}</td>
    </tr>`).join('')

    const logoBlock = activeCompany.logoUrl
      ? `<img class="logo" src="${esc(activeCompany.logoUrl)}" alt="${esc(activeCompany.name)}" />`
      : `<div class="company-name">${esc(activeCompany.name)}</div>`
    const generatedAt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<title>Tank/Umsatz ${esc(periodLabel)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a; font-size: 12px; line-height: 1.45; padding: 32px 40px 72px; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
    border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { max-height: 56px; max-width: 220px; object-fit: contain; }
  .company-name { font-size: 20px; font-weight: 700; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .doc-title p { margin: 2px 0 0; color: #64748b; font-size: 12px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #475569; margin: 24px 0 10px; }
  .cards { display: flex; gap: 12px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .card .label { color: #64748b; font-size: 11px; margin-bottom: 4px; }
  .card .value { font-size: 17px; font-weight: 700; }
  .pos { color: #047857; } .neg { color: #be123c; } .warnc { color: #b45309; }
  .accent { border-color: #059669; background: #ecfdf5; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .muted { color: #94a3b8; }
  tfoot td { border-top: 1px solid #cbd5e1; font-weight: 700; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between;
    padding: 8px 40px; font-size: 9px; color: #94a3b8; border-top: 1px solid #eef2f6; }
  @media print { body { padding-bottom: 72px; } @page { margin: 12mm; } }
</style></head>
<body>
  <header>
    <div>${logoBlock}</div>
    <div class="doc-title"><h1>Tank-zu-Umsatz-Ratio</h1><p>${esc(periodLabel)}</p></div>
  </header>
  <h2>Flotte gesamt</h2>
  <div class="cards">
    <div class="card"><div class="label">Umsatz</div><div class="value pos">${esc(formatEur(totalRevenue))}</div></div>
    <div class="card"><div class="label">Tankkosten</div><div class="value neg">${esc(formatEur(totalFuel))}</div></div>
    <div class="card accent"><div class="label">Ratio</div><div class="value ${cls(totalRatio)}">${esc(pct(totalRatio))}</div></div>
  </div>
  <h2>Je Fahrzeug (${stats.length})</h2>
  <table>
    <thead><tr><th>Kennzeichen</th><th>Modell</th><th class="num">Umsatz</th><th class="num">Tank</th><th class="num">Ratio</th></tr></thead>
    <tbody>${bodyRows || '<tr><td colspan="5" class="muted">Keine Buchungen im gewählten Zeitraum.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2">Gesamt</td><td class="num">${esc(formatEur(totalRevenue))}</td><td class="num">${esc(formatEur(totalFuel))}</td><td class="num ${cls(totalRatio)}">${esc(pct(totalRatio))}</td></tr></tfoot>
  </table>
  <p class="muted" style="margin-top:8px;font-size:10px">Ampel: bis ${config.warn}% grün · bis ${config.crit}% gelb · darüber rot.</p>
  <footer>
    <span>${esc(activeCompany.name)} · erstellt am ${esc(generatedAt)}</span>
    <span>erstellt mit TAS FLEET</span>
  </footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });<\/script>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) { setError('PDF-Fenster wurde vom Browser blockiert. Bitte Pop-ups erlauben.'); return }
    w.document.write(html); w.document.close()
  }

  const badgeVariant = (lvl: ReturnType<typeof ratioLevel>) =>
    lvl === 'crit' ? 'danger' : lvl === 'warn' ? 'warning' : lvl === 'good' ? 'success' : 'secondary'

  const pctText = (r: number | null) => (r === null ? '—' : `${r.toFixed(1).replace('.', ',')} %`)

  if (loading) {
    return <LoadingScreen label="Tank- & Umsatzdaten werden geladen…" />
  }

  return (
    <div className="space-y-6">
      {/* ── Zeitraum + Export ── */}
      <div className="animate-fade-up-delay flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(['monat', 'jahr'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                period === p
                  ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              {p === 'monat' ? 'Monatlich' : 'Jährlich'}
            </button>
          ))}
        </div>
        {isMonat ? (
          <div className="space-y-1">
            <Label htmlFor="fr-month" className="text-xs">Monat</Label>
            <Input id="fr-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="fr-year" className="text-xs">Jahr</Label>
            <Input id="fr-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ── Kennzahlen ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Euro className="h-4 w-4" /> Umsatz</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatEur(totalRevenue)}</p></CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Fuel className="h-4 w-4" /> Tankkosten</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{formatEur(totalFuel)}</p></CardContent>
        </Card>
        <Card className="surface-card surface-card-accent animate-fade-up-delay-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Percent className="h-4 w-4" /> Tank-zu-Umsatz</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <p className="text-2xl font-bold">{pctText(totalRatio)}</p>
            <Badge variant={badgeVariant(ratioLevel(totalRatio, config))}>{
              ratioLevel(totalRatio, config) === 'crit' ? 'kritisch'
                : ratioLevel(totalRatio, config) === 'warn' ? 'erhöht'
                : ratioLevel(totalRatio, config) === 'good' ? 'gut' : '—'
            }</Badge>
          </CardContent>
        </Card>
      </div>

      {/* ── Eingabe ── */}
      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Buchung erfassen</CardTitle>
          <CardDescription>Umsatz oder Tankkosten je Fahrzeug eintragen</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
              {(['umsatz', 'tank'] as EntryKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFormKind(k)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                    formKind === k
                      ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  {k === 'umsatz' ? <Euro className="h-4 w-4" /> : <Droplet className="h-4 w-4" />}
                  {k === 'umsatz' ? 'Umsatz' : 'Tankkosten'}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-xs">Fahrzeug</Label>
                <SearchableSelect
                  value={formVehicle}
                  onChange={setFormVehicle}
                  options={vehicleOptions}
                  placeholder="Fahrzeug wählen …"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fr-date" className="text-xs">Datum</Label>
                <Input id="fr-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fr-amount" className="text-xs">Betrag (€)</Label>
                <Input id="fr-amount" inputMode="decimal" placeholder="0,00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fr-note" className="text-xs">Notiz (optional)</Label>
              <Input id="fr-note" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="z. B. Beleg-Nr., Tankstelle" />
            </div>
            <Button type="submit" disabled={isBusy} className="gap-2">
              {showBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Hinzufügen
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Auswertung je Fahrzeug ── */}
      <Card className="surface-card animate-fade-up-delay-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Je Fahrzeug — {periodLabel}</CardTitle>
          <CardDescription>Kraftstoffanteil am Umsatz, sortiert nach höchster Ratio</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Keine Buchungen im gewählten Zeitraum.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Fahrzeug</th>
                    <th className="py-2 px-3 text-right">Umsatz</th>
                    <th className="py-2 px-3 text-right">Tankkosten</th>
                    <th className="py-2 pl-3 text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const lvl = ratioLevel(s.ratio, config)
                    return (
                      <tr key={s.vehicle.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{s.vehicle.license_plate}</p>
                          <p className="text-xs text-slate-400">{s.vehicle.model}</p>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatEur(s.revenue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatEur(s.fuel)}</td>
                        <td className="py-2 pl-3 text-right">
                          <Badge variant={badgeVariant(lvl)}>{pctText(s.ratio)}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold">
                    <td className="py-2 pr-3">Gesamt</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatEur(totalRevenue)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatEur(totalFuel)}</td>
                    <td className="py-2 pl-3 text-right">
                      <Badge variant={badgeVariant(ratioLevel(totalRatio, config))}>{pctText(totalRatio)}</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ampel-Schwellen (nur mit Einstellungsrecht) ── */}
      {canManageSettings && (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Ampel-Schwellwerte</CardTitle>
            <CardDescription>Ab wann eine Ratio als erhöht (gelb) bzw. kritisch (rot) gilt.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="fr-warn" className="text-xs">Gelb ab (%)</Label>
              <Input id="fr-warn" type="number" className="w-28" value={config.warn}
                onChange={(e) => saveConfig({ ...config, warn: Number(e.target.value) || DEFAULT_WARN })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fr-crit" className="text-xs">Rot ab (%)</Label>
              <Input id="fr-crit" type="number" className="w-28" value={config.crit}
                onChange={(e) => saveConfig({ ...config, crit: Number(e.target.value) || DEFAULT_CRIT })} />
            </div>
            {configSaved && <span className="text-sm text-emerald-600">Gespeichert ✓</span>}
          </CardContent>
        </Card>
      )}

      {/* ── Letzte Buchungen (löschbar) ── */}
      {recentEntries.length > 0 && (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Letzte Buchungen</CardTitle>
            <CardDescription>{periodLabel} · neueste zuerst</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentEntries.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 py-2 text-sm">
                  <Badge variant={r.kind === 'umsatz' ? 'success' : 'danger'}>{r.kind === 'umsatz' ? 'Umsatz' : 'Tank'}</Badge>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{r.plate}</span>
                  <span className="text-slate-400">{r.date}{r.note ? ` · ${r.note}` : ''}</span>
                  <span className="ml-auto tabular-nums">{formatEur(r.amount)}</span>
                  <button
                    type="button"
                    onClick={() => (r.kind === 'umsatz' ? handleDeleteRevenue(r.id) : handleDeleteFuel(r.id))}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
