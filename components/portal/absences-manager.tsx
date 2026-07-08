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
import { Download } from 'lucide-react'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { labelFor } from '@/lib/labels'
import { downloadCsv, todayStamp } from '@/lib/export'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [driverId, setDriverId] = useState<string>(drivers[0]?.id ?? '')
  const [type, setType] = useState<AbsenceType>('urlaub')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')

  function resetForm() {
    setEditingId(null)
    setDriverId(drivers[0]?.id ?? '')
    setType('urlaub')
    setStartDate(today)
    setEndDate(today)
    setReason('')
  }

  function startEdit(absence: AbsenceRow) {
    setEditingId(absence.id)
    setDriverId(absence.driver_id)
    setType(absence.type)
    setStartDate(absence.start_date)
    setEndDate(absence.end_date)
    setReason(absence.reason ?? '')
    setError(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    const { error: writeError } = editingId
      ? await supabase.from('absences').update(payload).eq('id', editingId)
      : await supabase.from('absences').insert(payload)
    if (writeError) {
      setError(writeError.message)
      setIsBusy(false)
      return
    }
    resetForm()
    setIsBusy(false)
  }

  // Resturlaub (laufendes Jahr): Kontingent − genommene Urlaubstage im Jahr.
  const vacationSummary = useMemo(() => {
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    return drivers
      .filter((d) => d.annual_vacation_days != null)
      .map((d) => {
        let used = 0
        for (const a of absences) {
          if (a.driver_id !== d.id || a.type !== 'urlaub') continue
          const from = a.start_date < yearStart ? yearStart : a.start_date
          const to = a.end_date > yearEnd ? yearEnd : a.end_date
          if (from > to) continue
          const days = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
          used += days
        }
        const quota = d.annual_vacation_days ?? 0
        return { id: d.id, name: d.name, quota, used, remaining: quota - used }
      })
  }, [drivers, absences])

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
          <CardTitle>{editingId ? 'Abwesenheit bearbeiten' : 'Abwesenheit erfassen'}</CardTitle>
          <CardDescription>Urlaub, Krankheit oder Sonstiges</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="absence-driver">Fahrer</Label>
              <SearchableSelect
                id="absence-driver"
                value={driverId}
                onChange={setDriverId}
                placeholder="Fahrer wählen …"
                options={drivers.map((d) => ({
                  value: d.id,
                  label: [d.first_name, d.last_name].filter(Boolean).join(' ') || d.name,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="absence-type">Art</Label>
              <select
                id="absence-type"
                className="flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
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

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isBusy || drivers.length === 0}>
                {showBusySpinner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Aktualisieren' : 'Abwesenheit speichern'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={isBusy}>
                  Abbrechen
                </Button>
              )}
            </div>
          </form>

          {vacationSummary.length > 0 && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Resturlaub {new Date().getFullYear()}
              </p>
              <ul className="space-y-1.5">
                {vacationSummary.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{v.name}</span>
                    <span className="tabular-nums">
                      <span className={v.remaining < 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-slate-900 dark:text-slate-100'}>
                        {v.remaining}
                      </span>
                      <span className="text-slate-400"> / {v.quota} Tage</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface-card animate-fade-up-delay-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Abwesenheiten</CardTitle>
            <CardDescription>Alle Einträge (neueste zuerst)</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={absences.length === 0}
            onClick={() =>
              downloadCsv(
                `abwesenheiten-${todayStamp()}`,
                ['Fahrer', 'Art', 'Von', 'Bis', 'Grund'],
                absences.map((a) => [driverName(a.driver_id), labelFor(a.type), a.start_date, a.end_date, a.reason ?? '']),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Keine Abwesenheiten erfasst.</p>
          ) : (
            <ul className="space-y-3">
              {absences.map((absence) => {
                const active = isAbsentToday(absence)
                return (
                  <li key={absence.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{driverName(absence.driver_id)}</span>
                          <Badge variant={typeVariant(absence.type)}>{labelFor(absence.type)}</Badge>
                          {active ? (
                            <Badge variant="warning" className="gap-1">
                              <CalendarOff className="h-3 w-3" />
                              Aktuell abwesend
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(absence)} disabled={isBusy}>
                            Bearbeiten
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(absence.id)} disabled={isBusy}>
                            Löschen
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <AbsenceCalendar absences={absences} driverName={driverName} />
      </div>
    </section>
  )
}

/** Team-Kalender: Monatsraster (Zeile je Fahrer) oder interaktiver Jahresüberblick. */
function AbsenceCalendar({
  absences,
  driverName,
}: {
  absences: AbsenceRow[]
  driverName: (id: string) => string
}) {
  const [view, setView] = useState<'monat' | 'jahr'>('jahr')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [year, setYear] = useState(() => new Date().getFullYear())

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Team-Kalender</CardTitle>
          <CardDescription>{view === 'monat' ? 'Abwesenheiten im Monat' : 'Jahresüberblick — über einen Tag fahren für Details'}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            {(['monat', 'jahr'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={
                  'rounded-md px-3 py-1 text-xs font-medium transition-all ' +
                  (view === v
                    ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')
                }
              >
                {v === 'monat' ? 'Monat' : 'Jahr'}
              </button>
            ))}
          </div>
          {view === 'monat' ? (
            <MonthNav month={month} setMonth={setMonth} />
          ) : (
            <YearNav year={year} setYear={setYear} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {view === 'monat' ? (
          <AbsenceMonthGrid absences={absences} driverName={driverName} month={month} />
        ) : (
          <AbsenceYearGrid absences={absences} driverName={driverName} year={year} />
        )}
      </CardContent>
    </Card>
  )
}

function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const [year, mon] = month.split('-').map(Number)
  function shiftMonth(delta: number) {
    const d = new Date(year, mon - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
      <span className="min-w-[9rem] text-center text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
        {new Date(year, mon - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => shiftMonth(1)}>›</Button>
    </div>
  )
}

function YearNav({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setYear(year - 1)}>‹</Button>
      <span className="min-w-[4rem] text-center text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">{year}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => setYear(year + 1)}>›</Button>
    </div>
  )
}

/** Monatsraster: Zeile je Fahrer, Tage farbcodiert. */
function AbsenceMonthGrid({
  absences,
  driverName,
  month,
}: {
  absences: AbsenceRow[]
  driverName: (id: string) => string
  month: string
}) {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`

  const rows = useMemo(() => {
    const relevant = absences.filter((a) => a.start_date <= monthEnd && a.end_date >= monthStart)
    const byDriver = new Map<string, AbsenceRow[]>()
    for (const a of relevant) {
      const list = byDriver.get(a.driver_id) ?? []
      list.push(a)
      byDriver.set(a.driver_id, list)
    }
    return Array.from(byDriver.entries())
  }, [absences, monthStart, monthEnd])

  function colorFor(driverAbsences: AbsenceRow[], day: number): string {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    const hit = driverAbsences.find((a) => a.start_date <= dateStr && dateStr <= a.end_date)
    if (!hit) return ''
    if (hit.type === 'urlaub') return 'bg-sky-400'
    if (hit.type === 'krankheit') return 'bg-rose-400'
    return 'bg-amber-400'
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Keine Abwesenheiten in diesem Monat.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white dark:bg-slate-900 px-2 py-1 text-left font-medium text-slate-500 dark:text-slate-400">Fahrer</th>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <th key={i} className="w-5 px-0 py-1 text-center font-normal text-slate-400">{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([driverId, list]) => (
            <tr key={driverId} className="border-t border-slate-100 dark:border-slate-800">
              <td className="sticky left-0 bg-white dark:bg-slate-900 px-2 py-1 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{driverName(driverId)}</td>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <td key={i} className="px-0 py-1">
                  <div className={`mx-auto h-4 w-4 rounded-sm ${colorFor(list, i + 1) || 'bg-slate-50 dark:bg-slate-800/50'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <CalendarLegend />
    </div>
  )
}

interface DayHit {
  absence: AbsenceRow
  driver: string
}

/** Interaktiver Jahresüberblick: 12 Mini-Monate, Tage farbcodiert, Hover-Popover mit Details. */
function AbsenceYearGrid({
  absences,
  driverName,
  year,
}: {
  absences: AbsenceRow[]
  driverName: (id: string) => string
  year: number
}) {
  const [hover, setHover] = useState<{ date: string; hits: DayHit[]; top: number; left: number } | null>(null)

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const relevant = useMemo(
    () => absences.filter((a) => a.start_date <= yearEnd && a.end_date >= yearStart),
    [absences, yearStart, yearEnd],
  )

  // Für jeden Tag: welche Abwesenheiten greifen (über alle Fahrer)?
  function hitsFor(dateStr: string): DayHit[] {
    return relevant
      .filter((a) => a.start_date <= dateStr && dateStr <= a.end_date)
      .map((a) => ({ absence: a, driver: driverName(a.driver_id) }))
  }

  function dominantColor(hits: DayHit[]): string {
    if (hits.some((h) => h.absence.type === 'krankheit')) return 'bg-rose-400 hover:bg-rose-500'
    if (hits.some((h) => h.absence.type === 'urlaub')) return 'bg-sky-400 hover:bg-sky-500'
    return 'bg-amber-400 hover:bg-amber-500'
  }

  function typeColor(type: AbsenceType): string {
    if (type === 'krankheit') return 'bg-rose-400'
    if (type === 'urlaub') return 'bg-sky-400'
    return 'bg-amber-400'
  }

  const months = Array.from({ length: 12 }, (_, m) => m)
  const weekdayLabels = ['M', 'D', 'M', 'D', 'F', 'S', 'S']

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((m) => {
          const daysInMonth = new Date(year, m + 1, 0).getDate()
          // Wochentag des 1. (Mo=0 … So=6).
          const firstWeekday = (new Date(year, m, 1).getDay() + 6) % 7
          const monthName = new Date(year, m, 1).toLocaleDateString('de-DE', { month: 'long' })
          return (
            <div key={m} className="rounded-lg border border-slate-200 dark:border-slate-700/60 p-2.5">
              <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{monthName}</p>
              <div className="grid grid-cols-7 gap-1">
                {weekdayLabels.map((w, i) => (
                  <span key={`w${i}`} className="text-center text-[9px] font-medium text-slate-300 dark:text-slate-600">{w}</span>
                ))}
                {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const hits = hitsFor(dateStr)
                  const has = hits.length > 0
                  return (
                    <div
                      key={day}
                      onMouseEnter={(e) => {
                        if (!has) return
                        const r = e.currentTarget.getBoundingClientRect()
                        setHover({ date: dateStr, hits, top: r.bottom + 6, left: r.left })
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={
                        'flex aspect-square items-center justify-center rounded-[3px] text-[9px] transition-colors ' +
                        (has
                          ? `${dominantColor(hits)} cursor-default font-semibold text-white`
                          : 'bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-600')
                      }
                    >
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <CalendarLegend />

      {hover && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ top: Math.min(hover.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200), left: Math.min(hover.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270) }}
        >
          <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
            {new Date(`${hover.date}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <ul className="space-y-1.5">
            {hover.hits.map((h) => (
              <li key={h.absence.id} className="flex items-start gap-2">
                <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm ${typeColor(h.absence.type)}`} />
                <span className="min-w-0">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{h.driver}</span>
                  <span className="text-slate-500 dark:text-slate-400"> · {labelFor(h.absence.type)}</span>
                  <br />
                  <span className="text-slate-400">
                    {new Date(`${h.absence.start_date}T00:00:00`).toLocaleDateString('de-DE')} – {new Date(`${h.absence.end_date}T00:00:00`).toLocaleDateString('de-DE')}
                  </span>
                  {h.absence.reason ? <><br /><span className="text-slate-400 italic">{h.absence.reason}</span></> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CalendarLegend() {
  return (
    <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-sky-400" /> Urlaub</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-rose-400" /> Krankheit</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-400" /> Sonstiges</span>
    </div>
  )
}
