'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, FileDown, Landmark, Loader2, Percent, Plus, Trash2, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveCompanyId, useCan, useTenant } from '@/components/portal/tenant-provider'
import {
  DEFAULT_HEBESATZ, LEGAL_FORM_LABELS, VAT_RATES, estimateTaxes, formatEur,
  summarizeVat, vatFromGross, type LegalForm,
} from '@/lib/taxes'
import { cn } from '@/lib/utils'

type FinanceRow = Database['public']['Tables']['finance_entries']['Row']
type SettingsRow = Database['public']['Tables']['settings']['Row']

type Period = 'monat' | 'jahr'

const EINNAHME_KATEGORIEN = ['Fahrterlöse', 'Zuschüsse', 'Sonstige Einnahmen']
const AUSGABE_KATEGORIEN = [
  'Kraftstoff / Laden', 'Wartung & Reparatur', 'Versicherung', 'Leasing / Finanzierung',
  'Löhne & Gehälter', 'Miete', 'Verwaltung', 'Sonstige Ausgaben',
]

interface FinanceConfig {
  legal_form: LegalForm
  hebesatz: number
  // Kleinunternehmer nach §19 UStG: kein USt-Ausweis, keine Vorsteuer, keine Zahllast.
  kleinunternehmer: boolean
}

function parseConfig(settings: SettingsRow[]): FinanceConfig {
  const row = settings.find((s) => s.key === 'finance_config')
  const v = (row?.value ?? {}) as Partial<FinanceConfig>
  return {
    legal_form: v.legal_form === 'personengesellschaft' ? 'personengesellschaft' : 'kapitalgesellschaft',
    hebesatz: typeof v.hebesatz === 'number' && v.hebesatz > 0 ? v.hebesatz : DEFAULT_HEBESATZ,
    kleinunternehmer: v.kleinunternehmer === true,
  }
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

interface FinanceManagerProps {
  initialEntries: FinanceRow[]
  initialSettings: SettingsRow[]
}

export function FinanceManager({ initialEntries, initialSettings }: FinanceManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const { activeCompany } = useTenant()
  const canManageSettings = useCan('manageSettings')

  const [entries, setEntries] = useState<FinanceRow[]>(initialEntries)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const showBusy = useDelayedLoading(isBusy)

  // ── Zeitraum ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>('monat')
  const [month, setMonth] = useState(currentMonthValue())
  const [year, setYear] = useState(String(new Date().getFullYear()))

  // ── Konfiguration (Rechtsform / Hebesatz) ─────────────────────────
  const [config, setConfig] = useState<FinanceConfig>(() => parseConfig(initialSettings))
  const [configSaved, setConfigSaved] = useState(false)

  async function saveConfig(next: FinanceConfig) {
    setConfig(next)
    setConfigSaved(false)
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert(
        { company_id: companyId, key: 'finance_config', value: next as unknown as Database['public']['Tables']['settings']['Row']['value'] },
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
    const { data, error: fetchError } = await supabase
      .from('finance_entries')
      .select('*')
      .eq('company_id', companyId)
      .order('entry_date', { ascending: false })
    if (fetchError) { setError(fetchError.message); return }
    setEntries(data ?? [])
  }

  useEffect(() => {
    const channel = supabase
      .channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_entries' }, () => {
        void refresh()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, companyId])

  // ── Formular ──────────────────────────────────────────────────────
  const [formKind, setFormKind] = useState<'einnahme' | 'ausgabe'>('einnahme')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formCategory, setFormCategory] = useState(EINNAHME_KATEGORIEN[0])
  const [formAmount, setFormAmount] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formVatRate, setFormVatRate] = useState<number>(19)

  const kategorien = formKind === 'einnahme' ? EINNAHME_KATEGORIEN : AUSGABE_KATEGORIEN

  function switchKind(kind: 'einnahme' | 'ausgabe') {
    setFormKind(kind)
    setFormCategory(kind === 'einnahme' ? EINNAHME_KATEGORIEN[0] : AUSGABE_KATEGORIEN[0])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(formAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Bitte einen gültigen Betrag größer 0 eingeben.')
      return
    }
    setIsBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('finance_entries').insert({
      company_id: companyId,
      entry_date: formDate,
      kind: formKind,
      category: formCategory,
      amount_eur: Math.round(amount * 100) / 100,
      vat_rate: config.kleinunternehmer ? 0 : formVatRate,
      description: formNote.trim() || null,
    })
    if (insertError) setError(insertError.message)
    else {
      setFormAmount('')
      setFormNote('')
      await refresh()
    }
    setIsBusy(false)
  }

  async function handleDelete(id: string) {
    setIsBusy(true)
    setError(null)
    const { error: deleteError } = await supabase.from('finance_entries').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await refresh()
    setIsBusy(false)
  }

  // ── Auswertung ────────────────────────────────────────────────────
  const periodEntries = useMemo(() => {
    const prefix = period === 'monat' ? month : year
    return entries.filter((e) => e.entry_date.startsWith(prefix))
  }, [entries, period, month, year])

  // USt-Aufstellung (Brutto/Netto/USt/Vorsteuer/Zahllast) über den Zeitraum.
  const vat = useMemo(() => summarizeVat(periodEntries), [periodEntries])
  const vatActive = !config.kleinunternehmer

  // EÜR/Gewinnermittlung: bei Regelbesteuerung auf Nettobasis (USt ist
  // durchlaufender Posten), bei Kleinunternehmer sind Brutto = Netto.
  const einnahmen = vat.einnahmenNetto
  const ausgaben = vat.ausgabenNetto
  const gewinn = einnahmen - ausgaben

  // Steuern beziehen sich auf das Jahresergebnis; bei Monatssicht wird der
  // Monatsgewinn zur Orientierung aufs Jahr hochgerechnet.
  const isMonat = period === 'monat'
  const steuerBasis = isMonat ? gewinn * 12 : gewinn
  const taxes = estimateTaxes(steuerBasis, config.legal_form, config.hebesatz)
  const anteilig = (v: number) => (isMonat ? v / 12 : v)

  const periodLabel = isMonat
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : `Jahr ${year}`

  // ── PDF / Druck ───────────────────────────────────────────────────
  function handleExportPdf() {
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))

    const taxRows: { label: string; value: number }[] = [
      { label: `Gewerbesteuer (${config.hebesatz} % Hebesatz)`, value: anteilig(taxes.gewerbesteuer) },
      ...(config.legal_form === 'kapitalgesellschaft'
        ? [
            { label: 'Körperschaftsteuer (15 %)', value: anteilig(taxes.koerperschaftsteuer) },
            { label: 'Solidaritätszuschlag (5,5 % der KSt)', value: anteilig(taxes.soli) },
          ]
        : []),
    ]

    const bookingRows = periodEntries
      .map((e) => {
        const sign = e.kind === 'einnahme' ? '+' : '−'
        const cls = e.kind === 'einnahme' ? 'pos' : 'neg'
        const date = new Date(`${e.entry_date}T00:00:00`).toLocaleDateString('de-DE')
        return `<tr>
          <td>${esc(date)}</td>
          <td>${esc(e.category)}${e.description ? ` <span class="muted">· ${esc(e.description)}</span>` : ''}</td>
          <td class="num ${cls}">${sign}${esc(formatEur(Number(e.amount_eur)))}</td>
        </tr>`
      })
      .join('')

    const logoBlock = activeCompany.logoUrl
      ? `<img class="logo" src="${esc(activeCompany.logoUrl)}" alt="${esc(activeCompany.name)}" />`
      : `<div class="company-name">${esc(activeCompany.name)}</div>`

    const generatedAt = new Date().toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<title>Finanzbericht ${esc(periodLabel)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a; font-size: 12px; line-height: 1.45;
    padding: 32px 40px 72px;
  }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
    border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { max-height: 56px; max-width: 220px; object-fit: contain; }
  .company-name { font-size: 20px; font-weight: 700; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .doc-title p { margin: 2px 0 0; color: #64748b; font-size: 12px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #475569;
    margin: 24px 0 10px; }
  .cards { display: flex; gap: 12px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .card .label { color: #64748b; font-size: 11px; margin-bottom: 4px; }
  .card .value { font-size: 17px; font-weight: 700; }
  .pos { color: #047857; } .neg { color: #be123c; }
  .accent { border-color: #059669; background: #ecfdf5; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .muted { color: #94a3b8; }
  .tax-total { font-weight: 700; }
  .tax-total td { border-top: 1px solid #cbd5e1; }
  .disclaimer { margin-top: 8px; color: #94a3b8; font-size: 10px; }
  footer { position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; justify-content: space-between;
    padding: 8px 40px; font-size: 9px; color: #94a3b8;
    border-top: 1px solid #eef2f6; }
  @media print { body { padding-bottom: 72px; } @page { margin: 12mm; } }
</style></head>
<body>
  <header>
    <div>${logoBlock}</div>
    <div class="doc-title">
      <h1>Finanzbericht</h1>
      <p>${esc(periodLabel)}</p>
    </div>
  </header>

  <h2>Übersicht (EÜR)</h2>
  <div class="cards">
    <div class="card"><div class="label">${vatActive ? 'Einnahmen (netto)' : 'Einnahmen'}</div><div class="value pos">${esc(formatEur(einnahmen))}</div></div>
    <div class="card"><div class="label">${vatActive ? 'Ausgaben (netto)' : 'Ausgaben'}</div><div class="value neg">${esc(formatEur(ausgaben))}</div></div>
    <div class="card accent"><div class="label">Gewinn / Verlust</div><div class="value ${gewinn >= 0 ? 'pos' : 'neg'}">${esc(formatEur(gewinn))}</div></div>
    <div class="card"><div class="label">Steuern (geschätzt)</div><div class="value">${esc(formatEur(anteilig(taxes.steuernGesamt)))}</div></div>
  </div>

  <h2>Steuerschätzung</h2>
  <table>
    <tbody>
      ${taxRows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${esc(formatEur(r.value))}</td></tr>`).join('')}
      <tr class="tax-total"><td>Steuern gesamt</td><td class="num">${esc(formatEur(anteilig(taxes.steuernGesamt)))}</td></tr>
      <tr class="tax-total"><td>Gewinn nach Steuern</td><td class="num ${anteilig(taxes.gewinnNachSteuern) >= 0 ? 'pos' : 'neg'}">${esc(formatEur(anteilig(taxes.gewinnNachSteuern)))}</td></tr>
    </tbody>
  </table>
  <p class="disclaimer">Vereinfachte Schätzung ohne Gewähr — ersetzt keine Steuerberatung.</p>

  ${vatActive ? `
  <h2>Umsatzsteuer</h2>
  <table>
    <tbody>
      <tr><td>Umsatzsteuer (vereinnahmt, aus ${esc(formatEur(vat.einnahmenBrutto))} brutto)</td><td class="num">${esc(formatEur(vat.umsatzsteuer))}</td></tr>
      <tr><td>Vorsteuer (abziehbar, aus ${esc(formatEur(vat.ausgabenBrutto))} brutto)</td><td class="num">−${esc(formatEur(vat.vorsteuer))}</td></tr>
      <tr class="tax-total"><td>${vat.zahllast >= 0 ? 'USt-Zahllast ans Finanzamt' : 'Vorsteuer-Überhang (Erstattung)'}</td><td class="num">${esc(formatEur(Math.abs(vat.zahllast)))}</td></tr>
    </tbody>
  </table>` : ''}

  <h2>Buchungen (${periodEntries.length})</h2>
  <table>
    <thead><tr><th>Datum</th><th>Kategorie</th><th class="num">Betrag</th></tr></thead>
    <tbody>${bookingRows || '<tr><td colspan="3" class="muted">Keine Buchungen im gewählten Zeitraum.</td></tr>'}</tbody>
  </table>

  <footer>
    <span>${esc(activeCompany.name)} · erstellt am ${esc(generatedAt)}</span>
    <span>erstellt mit TAS FLEET</span>
  </footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });<\/script>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      setError('PDF-Fenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      {/* ── Zeitraum-Wahl ── */}
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
            <Label htmlFor="fin-month" className="text-xs">Monat</Label>
            <Input id="fin-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="fin-year" className="text-xs">Jahr</Label>
            <Input
              id="fin-year" type="number" min="2020" max="2100" value={year}
              onChange={(e) => setYear(e.target.value)} className="w-28"
            />
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} className="ml-auto gap-2">
          <FileDown className="h-4 w-4" />
          PDF erstellen
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* ── Ergebnis-Kacheln ── */}
      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {vatActive ? 'Einnahmen (netto)' : 'Einnahmen'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatEur(einnahmen)}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> {vatActive ? 'Ausgaben (netto)' : 'Ausgaben'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatEur(ausgaben)}</p>
          </CardContent>
        </Card>
        <Card className="surface-card surface-card-accent animate-fade-up-delay-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" /> Gewinn / Verlust (EÜR)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              'text-2xl font-bold tabular-nums',
              gewinn >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
            )}>
              {formatEur(gewinn)}
            </p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-amber-600" /> Steuern (geschätzt)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatEur(anteilig(taxes.steuernGesamt))}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── Umsatzsteuer-Voranmeldung ── */}
      {vatActive && (
        <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <Card className="surface-card animate-fade-up-delay">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Umsatzsteuer (vereinnahmt)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatEur(vat.umsatzsteuer)}</p>
              <p className="mt-0.5 text-xs text-slate-400">aus {formatEur(vat.einnahmenBrutto)} brutto</p>
            </CardContent>
          </Card>
          <Card className="surface-card animate-fade-up-delay-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Vorsteuer (abziehbar)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatEur(vat.vorsteuer)}</p>
              <p className="mt-0.5 text-xs text-slate-400">aus {formatEur(vat.ausgabenBrutto)} brutto</p>
            </CardContent>
          </Card>
          <Card className="surface-card surface-card-accent animate-fade-up-delay-3 col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
                {vat.zahllast >= 0 ? 'USt-Zahllast' : 'Vorsteuer-Überhang'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className={cn(
                'text-2xl font-bold tabular-nums',
                vat.zahllast >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-700 dark:text-emerald-400',
              )}>
                {formatEur(Math.abs(vat.zahllast))}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {vat.zahllast >= 0 ? 'ans Finanzamt' : 'Erstattung vom Finanzamt'}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Buchungen ── */}
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Buchungen — {periodLabel}</CardTitle>
            <CardDescription>Einnahmen und Ausgaben für die Gewinnermittlung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Erfassen */}
            <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4">
              <div className="flex gap-1 rounded-lg bg-white dark:bg-slate-900 p-1 w-fit border border-slate-200 dark:border-slate-700/60">
                {(['einnahme', 'ausgabe'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchKind(k)}
                    className={cn(
                      'rounded-md px-3 py-1 text-sm font-medium transition-all',
                      formKind === k
                        ? k === 'einnahme'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {k === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="fin-date" className="text-xs">Datum</Label>
                  <Input id="fin-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fin-cat" className="text-xs">Kategorie</Label>
                  <select
                    id="fin-cat"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {kategorien.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fin-amount" className="text-xs">Betrag (EUR{vatActive ? ', brutto' : ''})</Label>
                  <Input
                    id="fin-amount" inputMode="decimal" placeholder="0,00" value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)} required
                  />
                </div>
                {vatActive && (
                  <div className="space-y-1">
                    <Label htmlFor="fin-vat" className="text-xs">USt-Satz</Label>
                    <select
                      id="fin-vat"
                      value={formVatRate}
                      onChange={(e) => setFormVatRate(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>{r === 0 ? 'steuerfrei (0 %)' : `${r} %`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="fin-note" className="text-xs">Beschreibung (optional)</Label>
                  <Input id="fin-note" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="z. B. Tankrechnung" />
                </div>
              </div>

              <Button type="submit" size="sm" disabled={isBusy}>
                {showBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Buchung erfassen
              </Button>
            </form>

            {/* Liste */}
            {periodEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700/60 p-6 text-center text-sm italic text-slate-400 dark:text-slate-500">
                Noch keine Buchungen im gewählten Zeitraum.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                {periodEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm">
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      entry.kind === 'einnahme'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300',
                    )}>
                      {entry.kind === 'einnahme'
                        ? <ArrowUpCircle className="h-4 w-4" />
                        : <ArrowDownCircle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{entry.category}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString('de-DE')}
                        {entry.description ? ` · ${entry.description}` : ''}
                        {vatActive && Number(entry.vat_rate) > 0
                          ? ` · ${entry.vat_rate} % USt (${formatEur(vatFromGross(Number(entry.amount_eur), Number(entry.vat_rate)))})`
                          : ''}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      entry.kind === 'einnahme' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
                    )}>
                      {entry.kind === 'einnahme' ? '+' : '−'}{formatEur(Number(entry.amount_eur))}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(entry.id)}
                      disabled={isBusy}
                      aria-label="Buchung löschen"
                      className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Steuerschätzung ── */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="surface-card animate-fade-up-delay-3">
            <CardHeader>
              <CardTitle>Steuerschätzung</CardTitle>
              <CardDescription>
                {isMonat
                  ? 'Monatsanteil — Basis: aufs Jahr hochgerechneter Gewinn'
                  : `Bezogen auf das Jahresergebnis ${year}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: `Gewerbesteuer (${config.hebesatz} % Hebesatz)`, value: anteilig(taxes.gewerbesteuer) },
                ...(config.legal_form === 'kapitalgesellschaft'
                  ? [
                      { label: 'Körperschaftsteuer (15 %)', value: anteilig(taxes.koerperschaftsteuer) },
                      { label: 'Solidaritätszuschlag (5,5 % der KSt)', value: anteilig(taxes.soli) },
                    ]
                  : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 px-3 py-2">
                  <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatEur(row.value)}</span>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2 rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold">
                <span className="text-slate-700 dark:text-slate-200">Steuern gesamt</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-100">{formatEur(anteilig(taxes.steuernGesamt))}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md bg-brand-50 dark:bg-brand-950/40 px-3 py-2 font-semibold">
                <span className="text-brand-800 dark:text-brand-200">Gewinn nach Steuern</span>
                <span className={cn(
                  'tabular-nums',
                  anteilig(taxes.gewinnNachSteuern) >= 0
                    ? 'text-brand-800 dark:text-brand-200'
                    : 'text-rose-700 dark:text-rose-400',
                )}>
                  {formatEur(anteilig(taxes.gewinnNachSteuern))}
                </span>
              </div>

              {config.legal_form === 'personengesellschaft' && (
                <p className="pt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Freibetrag 24.500 € berücksichtigt. Statt Körperschaftsteuer fällt die persönliche
                  Einkommensteuer der Inhaber an (hier nicht berechnet); die Gewerbesteuer wird darauf
                  teilweise angerechnet (§ 35 EStG).
                </p>
              )}
              <p className="pt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                Vereinfachte Schätzung ohne Gewähr — ersetzt keine Steuerberatung.
              </p>
            </CardContent>
          </Card>

          {canManageSettings && (
            <Card className="surface-card animate-fade-up-delay-3">
              <CardHeader>
                <CardTitle className="text-base">Konfiguration</CardTitle>
                <CardDescription className="text-xs">Rechtsform und Gewerbesteuer-Hebesatz der Gemeinde</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="fin-form" className="text-xs">Rechtsform</Label>
                  <select
                    id="fin-form"
                    value={config.legal_form}
                    onChange={(e) => void saveConfig({ ...config, legal_form: e.target.value as LegalForm })}
                    className="flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {(Object.keys(LEGAL_FORM_LABELS) as LegalForm[]).map((f) => (
                      <option key={f} value={f}>{LEGAL_FORM_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fin-hebesatz" className="text-xs">Hebesatz (%)</Label>
                  <Input
                    id="fin-hebesatz" type="number" min="200" max="900" value={config.hebesatz}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isFinite(v)) setConfig((c) => ({ ...c, hebesatz: v }))
                    }}
                    onBlur={() => void saveConfig(config)}
                  />
                </div>
                <label className="flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.kleinunternehmer}
                    onChange={(e) => void saveConfig({ ...config, kleinunternehmer: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-slate-100">Kleinunternehmer (§19 UStG)</span>
                    <br />Kein USt-Ausweis, keine Vorsteuer, keine Zahllast.
                  </span>
                </label>
                {configSaved && (
                  <Badge variant="success">Gespeichert ✓</Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
