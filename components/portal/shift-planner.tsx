'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Save, Check, Download } from 'lucide-react'
// pdf-lib wird erst beim PDF-Export dynamisch geladen (kleineres Initial-Bundle).
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { createClient } from '@/lib/supabase/client'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { parseHourValue, formatHours } from '@/lib/timesheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type WeekdayCode = 'MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA' | 'SO'

type TimesheetRow = Database['public']['Tables']['timesheet_entries']['Row']

interface WeeklyTimesheetRow {
  day: WeekdayCode
  date: string
  start: string
  end: string
  pause: string
  workHours: string
  overtimeHours: string
  note: string
}

interface ShiftPlannerProps {
  initialShifts: ShiftRow[]
  drivers: DriverRow[]
}

const weekdays: WeekdayCode[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']
const sharedRowFields: Array<keyof Omit<WeeklyTimesheetRow, 'day' | 'date' | 'note'>> = [
  'start',
  'end',
  'pause',
  'workHours',
  'overtimeHours',
]

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getCurrentIsoWeekValue() {
  const now = new Date()
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${pad2(week)}`
}

function parseIsoWeekValue(value: string) {
  const match = value.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null
  return { year, week }
}

function getStartOfIsoWeek(isoWeekValue: string) {
  const parsed = parseIsoWeekValue(isoWeekValue)
  if (!parsed) return null

  const { year, week } = parsed
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const day = simple.getUTCDay() || 7
  const monday = new Date(simple)
  if (day <= 4) {
    monday.setUTCDate(simple.getUTCDate() - day + 1)
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - day)
  }
  return monday
}

function getIsoWeekValueFromDate(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${pad2(week)}`
}

function addWeeks(isoWeekValue: string, deltaWeeks: number) {
  const weekStart = getStartOfIsoWeek(isoWeekValue)
  if (!weekStart) return isoWeekValue

  const next = new Date(weekStart)
  next.setUTCDate(weekStart.getUTCDate() + deltaWeeks * 7)
  return getIsoWeekValueFromDate(next)
}

function formatWeekLabel(isoWeekValue: string) {
  const parsed = parseIsoWeekValue(isoWeekValue)
  if (!parsed) return isoWeekValue
  return `KW ${parsed.week} / ${parsed.year}`
}

function shiftLabel(shift: ShiftRow['shift_slot']) {
  if (shift === 'Frueh') return 'Früh'
  if (shift === 'Spaet') return 'Spät'
  return shift
}

function createRowsForWeek(isoWeekValue: string) {
  const weekStart = getStartOfIsoWeek(isoWeekValue)

  if (!weekStart) {
    return weekdays.map((day) => ({
      day,
      date: '',
      start: '',
      end: '',
      pause: '',
      workHours: '',
      overtimeHours: '',
      note: '',
    }))
  }

  return weekdays.map((day, index) => {
    const date = new Date(weekStart)
    date.setUTCDate(weekStart.getUTCDate() + index)

    return {
      day,
      date: toDateInputValue(date),
      start: '',
      end: '',
      pause: '',
      workHours: '',
      overtimeHours: '',
      note: '',
    }
  })
}

function safePdfText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function buildRowsFromShifts(
  baseRows: WeeklyTimesheetRow[],
  shifts: ShiftRow[],
  driverId: string,
  weekStart: Date | null
) {
  if (!driverId || !weekStart) return baseRows

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  const inWeekDriverShifts = shifts.filter((shift) => {
    if (shift.driver_id !== driverId) return false
    if (!shift.shift_date) return false

    const date = new Date(`${shift.shift_date}T00:00:00Z`)
    return date >= weekStart && date <= weekEnd
  })

  const notesByDay = new Map<string, string[]>()
  for (const shift of inWeekDriverShifts) {
    const noteParts = [shiftLabel(shift.shift_slot), `Zone: ${shift.uber_zone}`]
    if (shift.notes) noteParts.push(shift.notes)

    const current = notesByDay.get(shift.shift_date) ?? []
    current.push(noteParts.join(' | '))
    notesByDay.set(shift.shift_date, current)
  }

  return baseRows.map((row) => {
    const shiftNotes = notesByDay.get(row.date)
    if (!shiftNotes || shiftNotes.length === 0) return row
    return {
      ...row,
      note: shiftNotes.join(' / '),
    }
  })
}

export function ShiftPlanner({ initialShifts, drivers }: ShiftPlannerProps) {
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[0]?.id ?? '')
  const [selectedWeek, setSelectedWeek] = useState(getCurrentIsoWeekValue())
  const [rows, setRows] = useState<WeeklyTimesheetRow[]>(() => createRowsForWeek(getCurrentIsoWeekValue()))
  const [isPdfBusy, setIsPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const showPdfSpinner = useDelayedLoading(isPdfBusy)

  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [monthEntries, setMonthEntries] = useState<TimesheetRow[]>([])
  // Verhindert, dass ein Realtime-/Lade-Refresh ungespeicherte Eingaben überschreibt.
  const isDirtyRef = useRef(false)

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  )

  const weekOptions = useMemo(() => {
    const options = new Set<string>()
    for (let offset = -8; offset <= 8; offset += 1) {
      options.add(addWeeks(selectedWeek, offset))
    }
    options.add(getCurrentIsoWeekValue())
    options.add(selectedWeek)

    return Array.from(options).sort()
  }, [selectedWeek])

  // Monatszeitraum (für das Stundenkonto) aus der gewählten Woche ableiten.
  const monthRange = useMemo(() => {
    const weekStart = getStartOfIsoWeek(selectedWeek)
    if (!weekStart) return null
    const year = weekStart.getUTCFullYear()
    const month = weekStart.getUTCMonth()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const label = new Date(Date.UTC(year, month, 1)).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    return {
      first: `${year}-${pad2(month + 1)}-01`,
      last: `${year}-${pad2(month + 1)}-${pad2(lastDay)}`,
      label,
    }
  }, [selectedWeek])

  const loadWeek = useCallback(async () => {
    const weekStart = getStartOfIsoWeek(selectedWeek)
    const baseRows = createRowsForWeek(selectedWeek)

    if (!selectedDriverId) {
      setRows(baseRows)
      return
    }

    const dates = baseRows.map((row) => row.date).filter(Boolean)
    setIsLoading(true)
    const { data } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('driver_id', selectedDriverId)
      .in('work_date', dates)
    setIsLoading(false)

    if (data && data.length > 0) {
      const byDate = new Map(data.map((entry) => [entry.work_date, entry]))
      setRows(
        baseRows.map((row) => {
          const entry = byDate.get(row.date)
          if (!entry) return row
          return {
            ...row,
            start: entry.start_time ?? '',
            end: entry.end_time ?? '',
            pause: entry.pause ?? '',
            workHours: entry.work_hours ?? '',
            overtimeHours: entry.overtime_hours ?? '',
            note: entry.note ?? '',
          }
        }),
      )
    } else {
      // Noch nichts gespeichert -> aus der Disposition vorbefüllen.
      setRows(buildRowsFromShifts(baseRows, initialShifts, selectedDriverId, weekStart))
    }
    isDirtyRef.current = false
  }, [supabase, selectedDriverId, selectedWeek, initialShifts])

  const loadMonth = useCallback(async () => {
    if (!selectedDriverId || !monthRange) {
      setMonthEntries([])
      return
    }
    const { data } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('driver_id', selectedDriverId)
      .gte('work_date', monthRange.first)
      .lte('work_date', monthRange.last)
    setMonthEntries(data ?? [])
  }, [supabase, selectedDriverId, monthRange])

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  // Realtime: Änderungen von Kollegen übernehmen, solange nichts Ungespeichertes offen ist.
  useEffect(() => {
    if (!selectedDriverId) return
    const channel = supabase
      .channel(`timesheets-${selectedDriverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timesheet_entries', filter: `driver_id=eq.${selectedDriverId}` },
        () => {
          if (!isDirtyRef.current) void loadWeek()
          void loadMonth()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, selectedDriverId, loadWeek, loadMonth])

  const monthIstHours = useMemo(
    () => monthEntries.reduce((sum, entry) => sum + Number(entry.work_hours_num ?? 0), 0),
    [monthEntries],
  )
  const monthOvertimeHours = useMemo(
    () => monthEntries.reduce((sum, entry) => sum + Number(entry.overtime_num ?? 0), 0),
    [monthEntries],
  )
  const monthTargetHours = useMemo(() => {
    const weekly = selectedDriver?.weekly_target_hours
    if (!weekly) return null
    // grobe Schätzung: Wochensoll / 7 * Tage im Monat
    const days = monthRange ? new Date(monthRange.last).getUTCDate() : 30
    return (Number(weekly) / 7) * days
  }, [selectedDriver, monthRange])

  async function handleSave() {
    if (!selectedDriverId || !companyId) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const toUpsert: Database['public']['Tables']['timesheet_entries']['Insert'][] = []
      const toDeleteDates: string[] = []

      for (const row of rows) {
        if (!row.date) continue
        const hasContent = [row.start, row.end, row.pause, row.workHours, row.overtimeHours, row.note].some(
          (value) => value.trim() !== '',
        )
        if (hasContent) {
          toUpsert.push({
            company_id: companyId,
            driver_id: selectedDriverId,
            work_date: row.date,
            start_time: row.start || null,
            end_time: row.end || null,
            pause: row.pause || null,
            work_hours: row.workHours || null,
            overtime_hours: row.overtimeHours || null,
            work_hours_num: parseHourValue(row.workHours),
            overtime_num: parseHourValue(row.overtimeHours),
            note: row.note || null,
          })
        } else {
          toDeleteDates.push(row.date)
        }
      }

      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('timesheet_entries')
          .upsert(toUpsert, { onConflict: 'company_id,driver_id,work_date' })
        if (error) throw error
      }
      if (toDeleteDates.length > 0) {
        const { error } = await supabase
          .from('timesheet_entries')
          .delete()
          .eq('driver_id', selectedDriverId)
          .in('work_date', toDeleteDates)
        if (error) throw error
      }

      isDirtyRef.current = false
      setSavedAt(Date.now())
      await loadMonth()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleExportCsv() {
    const header = ['Datum', 'Start', 'Ende', 'Pause', 'Arbeitszeit', 'Überstunden', 'Bemerkung']
    const sorted = [...monthEntries].sort((a, b) => a.work_date.localeCompare(b.work_date))
    const lines = sorted.map((entry) => [
      entry.work_date,
      entry.start_time ?? '',
      entry.end_time ?? '',
      entry.pause ?? '',
      entry.work_hours ?? '',
      entry.overtime_hours ?? '',
      entry.note ?? '',
    ])
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeDriver = (selectedDriver?.name || 'mitarbeiter')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .toLowerCase()
    link.href = url
    link.download = `stundenkonto-${safeDriver}-${monthRange?.first.slice(0, 7) ?? ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function updateRow(day: WeekdayCode, field: keyof Omit<WeeklyTimesheetRow, 'day'>, value: string) {
    isDirtyRef.current = true
    setRows((current) => {
      const next = current.map((row) => {
        if (row.day !== day) return row
        return {
          ...row,
          [field]: value,
        }
      })

      if (day === 'MO' && sharedRowFields.includes(field as (typeof sharedRowFields)[number])) {
        return next.map((row) => ({
          ...row,
          [field]: value,
        }))
      }

      return next
    })
  }

  const totalWorkHours = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + parseHourValue(row.workHours), 0)
    return total.toFixed(2).replace('.', ',')
  }, [rows])

  async function handleDownloadPdf() {
    setPdfError(null)
    setIsPdfBusy(true)

    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595, 842])
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

      page.drawText('Stundenbuch für Arbeit', {
        x: 18,
        y: 804,
        size: 20,
        font: boldFont,
        color: rgb(0.08, 0.11, 0.16),
      })

      page.drawText(`Mitarbeiter: ${safePdfText(selectedDriver?.name ?? '-')}`, {
        x: 18,
        y: 784,
        size: 10,
        font: regularFont,
        color: rgb(0.18, 0.21, 0.25),
      })
      page.drawText(`Woche: ${safePdfText(selectedWeek)}`, {
        x: 250,
        y: 784,
        size: 10,
        font: regularFont,
        color: rgb(0.18, 0.21, 0.25),
      })

      const tableX = 14
      const tableTopY = 765
      const rowHeight = 22
      const columnWidths = [32, 66, 52, 52, 46, 62, 66, 177]
      const lineColor = rgb(0.4, 0.45, 0.5)
      const headerBg = rgb(0.92, 0.95, 0.97)

      const drawRow = (y: number, cells: string[], isHeader = false, isFooter = false) => {
        let x = tableX
        for (let index = 0; index < columnWidths.length; index += 1) {
          const width = columnWidths[index]

          page.drawRectangle({
            x,
            y: y - rowHeight,
            width,
            height: rowHeight,
            borderColor: lineColor,
            borderWidth: 0.8,
            color: isHeader || isFooter ? headerBg : rgb(1, 1, 1),
          })

          const rawText = cells[index] ?? ''
          const text = safePdfText(rawText)
          const maxChars = index === 7 ? 28 : 12
          const compact = text.length > maxChars ? `${text.slice(0, maxChars)}...` : text

          page.drawText(compact, {
            x: x + 3,
            y: y - rowHeight + 7,
            size: 8,
            font: isHeader || isFooter ? boldFont : regularFont,
            color: rgb(0.13, 0.16, 0.2),
          })

          x += width
        }
      }

      drawRow(tableTopY, ['Tag', 'Datum', 'Start', 'Ende', 'Pause', 'Arbeit', 'Überst.', 'Bemerkung'], true)

      let currentY = tableTopY - rowHeight
      for (const row of rows) {
        drawRow(currentY, [row.day, row.date, row.start, row.end, row.pause, row.workHours, row.overtimeHours, row.note])
        currentY -= rowHeight
      }

      drawRow(currentY, ['', 'Stunden Gesamt', '', '', '', totalWorkHours, '', ''], false, true)

      const bytes = await pdfDoc.save()
      const buffer = new ArrayBuffer(bytes.length)
      new Uint8Array(buffer).set(bytes)
      const blob = new Blob([buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      const safeDriver = (selectedDriver?.name || 'mitarbeiter')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .toLowerCase()
      const safeWeek = selectedWeek.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
      link.href = url
      link.download = `stundenzettel-${safeDriver}-${safeWeek}.pdf`
      link.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.'
      setPdfError(message)
    } finally {
      setIsPdfBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="rounded-t-lg border-b border-slate-200 bg-slate-50">
          <CardTitle>Wöchentlicher Stundenzettel</CardTitle>
          <CardDescription>Mitarbeiter und Woche auswählen, Zeiten erfassen, PDF exportieren</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="timesheet-driver" className="text-xs uppercase tracking-wide text-slate-500">
                Mitarbeiter
              </Label>
              <select
                id="timesheet-driver"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                required
              >
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timesheet-week" className="text-xs uppercase tracking-wide text-slate-500">
                Woche (direkt)
              </Label>
              <Input
                id="timesheet-week"
                type="week"
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
                className="border-slate-300 bg-white shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timesheet-week-select" className="text-xs uppercase tracking-wide text-slate-500">
                Woche (Auswahl)
              </Label>
              <select
                id="timesheet-week-select"
                className="flex h-10 w-full min-w-[160px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
              >
                {weekOptions.map((weekValue) => (
                  <option key={weekValue} value={weekValue}>
                    {formatWeekLabel(weekValue)}
                  </option>
                ))}
              </select>
            </div>

            <Button type="button" variant="secondary" onClick={() => setSelectedWeek(addWeeks(selectedWeek, -1))}>
              Vorige Woche
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setSelectedWeek(getCurrentIsoWeekValue())}>
                Diese Woche
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}>
                Nächste Woche
              </Button>
            </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-700">
              Tipp: Wenn du in der Zeile MO Start, Ende, Pause, Arbeitszeit oder Überstunden eingibst, wird der Wert automatisch auf alle Tage übernommen.
            </p>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[46px_96px_1fr_1fr_1fr_1fr_1fr_2fr] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Tag</span>
              <span>Datum</span>
              <span>Start</span>
              <span>Ende</span>
              <span>Pause</span>
              <span>Arbeitszeit</span>
              <span>Überstunden</span>
              <span>Bemerkung</span>
            </div>

            {rows.map((row, index) => (
              <div
                key={row.day}
                className={`rounded-lg border p-2.5 ${
                  index % 2 === 0
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="grid gap-2 md:grid-cols-[46px_96px_1fr_1fr_1fr_1fr_1fr_2fr]">
                  <div className="space-y-1">
                    <Label htmlFor={`row-day-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Tag
                    </Label>
                    <Input id={`row-day-${row.day}`} value={row.day} readOnly className="border-slate-200 bg-slate-100" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-date-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Datum
                    </Label>
                    <Input id={`row-date-${row.day}`} value={row.date} readOnly className="border-slate-200 bg-slate-100" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-start-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Start
                    </Label>
                    <Input
                      id={`row-start-${row.day}`}
                      value={row.start}
                      onChange={(event) => updateRow(row.day, 'start', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-end-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Ende
                    </Label>
                    <Input
                      id={`row-end-${row.day}`}
                      value={row.end}
                      onChange={(event) => updateRow(row.day, 'end', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-break-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Pause
                    </Label>
                    <Input
                      id={`row-break-${row.day}`}
                      value={row.pause}
                      onChange={(event) => updateRow(row.day, 'pause', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-work-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Arbeitszeit
                    </Label>
                    <Input
                      id={`row-work-${row.day}`}
                      value={row.workHours}
                      onChange={(event) => updateRow(row.day, 'workHours', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-over-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Überstunden
                    </Label>
                    <Input
                      id={`row-over-${row.day}`}
                      value={row.overtimeHours}
                      onChange={(event) => updateRow(row.day, 'overtimeHours', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-note-${row.day}`} className="text-[11px] text-slate-500 md:hidden">
                      Bemerkung
                    </Label>
                    <Input
                      id={`row-note-${row.day}`}
                      value={row.note}
                      onChange={(event) => updateRow(row.day, 'note', event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-700">
                Stunden gesamt: <span className="font-semibold">{totalWorkHours}</span>
              </p>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !selectedDriverId || !companyId}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Speichert…' : 'Speichern'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleDownloadPdf()}
                disabled={isPdfBusy || !selectedDriverId}
              >
                {showPdfSpinner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPdfBusy ? 'PDF…' : 'PDF'}
              </Button>
            </div>
          </div>

          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          {savedAt && !isSaving ? (
            <p className="flex items-center gap-1.5 text-sm text-brand-700">
              <Check className="h-4 w-4" /> Gespeichert.
            </p>
          ) : null}
          {pdfError ? <p className="text-sm text-red-600">{pdfError}</p> : null}
        </CardContent>
      </Card>

      {/* Monats-Stundenkonto für den gewählten Fahrer */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between rounded-t-lg border-b border-slate-200 bg-slate-50">
          <div>
            <CardTitle>Stundenkonto</CardTitle>
            <CardDescription>
              {selectedDriver?.name ?? 'Fahrer'} · {monthRange?.label ?? ''}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={monthEntries.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Ist-Stunden</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{formatHours(monthIstHours)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Überstunden</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{formatHours(monthOvertimeHours)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Soll-Stunden</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">
                {monthTargetHours !== null ? formatHours(monthTargetHours) : '—'}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Erfasste Tage</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{monthEntries.length}</p>
            </div>
          </div>
          {monthTargetHours === null ? (
            <p className="mt-3 text-xs text-slate-400">
              Hinterlege „Wochensoll (Std.)" beim Fahrer, um Soll/Ist zu vergleichen. (optional)
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
