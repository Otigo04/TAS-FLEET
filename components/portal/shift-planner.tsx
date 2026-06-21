'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Database } from '@/lib/supabase/database.types'
import { useDelayedLoading } from '@/lib/use-delayed-loading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type ShiftRow = Database['public']['Tables']['shift_assignments']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type WeekdayCode = 'MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA' | 'SO'

type TimesheetDraftMap = Record<string, WeeklyTimesheetRow[]>

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

const draftStorageKey = 'timesheet-weekly-drafts-v1'
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

function parseHourValue(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return 0

  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [hoursPart, minutesPart] = normalized.split(':')
    const hours = Number(hoursPart)
    const minutes = Number(minutesPart)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours + minutes / 60
    }
  }

  const numberValue = Number(normalized)
  return Number.isNaN(numberValue) ? 0 : numberValue
}

function buildDraftKey(driverId: string, isoWeekValue: string) {
  return `${driverId}__${isoWeekValue}`
}

function loadDraftsFromStorage(): TimesheetDraftMap {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(draftStorageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as TimesheetDraftMap
    return parsed ?? {}
  } catch {
    return {}
  }
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

  useEffect(() => {
    const weekStart = getStartOfIsoWeek(selectedWeek)
    const baseRows = createRowsForWeek(selectedWeek)

    if (!selectedDriverId) {
      setRows(baseRows)
      return
    }

    const draftKey = buildDraftKey(selectedDriverId, selectedWeek)
    const drafts = loadDraftsFromStorage()
    const draftRows = drafts[draftKey]

    if (draftRows && draftRows.length === weekdays.length) {
      setRows(
        draftRows.map((row, index) => ({
          ...row,
          day: weekdays[index],
          date: baseRows[index].date,
        }))
      )
      return
    }

    setRows(buildRowsFromShifts(baseRows, initialShifts, selectedDriverId, weekStart))
  }, [initialShifts, selectedDriverId, selectedWeek])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedDriverId) return

    const draftKey = buildDraftKey(selectedDriverId, selectedWeek)
    const currentDrafts = loadDraftsFromStorage()
    const nextDrafts = {
      ...currentDrafts,
      [draftKey]: rows,
    }

    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts))
    } catch {
      // ignore localStorage errors to keep the UI responsive
    }
  }, [rows, selectedDriverId, selectedWeek])

  function updateRow(day: WeekdayCode, field: keyof Omit<WeeklyTimesheetRow, 'day'>, value: string) {
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
      <Card className="animate-fade-up-delay border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-sm">
        <CardHeader className="rounded-t-xl border-b border-sky-200/70 bg-white/65 backdrop-blur">
          <CardTitle>Wöchentlicher Stundenzettel</CardTitle>
          <CardDescription>Mitarbeiter und Woche auswählen, Zeiten erfassen, PDF exportieren</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-sky-200/70 bg-sky-100/60 p-3">
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="timesheet-driver" className="text-xs uppercase tracking-wide text-sky-700">
                Mitarbeiter
              </Label>
              <select
                id="timesheet-driver"
                className="flex h-10 w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm shadow-sm"
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
              <Label htmlFor="timesheet-week" className="text-xs uppercase tracking-wide text-sky-700">
                Woche (direkt)
              </Label>
              <Input
                id="timesheet-week"
                type="week"
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
                className="border-sky-300 bg-white shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timesheet-week-select" className="text-xs uppercase tracking-wide text-sky-700">
                Woche (Auswahl)
              </Label>
              <select
                id="timesheet-week-select"
                className="flex h-10 w-full min-w-[160px] rounded-md border border-sky-300 bg-white px-3 py-2 text-sm shadow-sm"
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

          <div className="rounded-lg border border-cyan-200 bg-cyan-50/80 p-3">
            <p className="text-xs text-cyan-900">
              Tipp: Wenn du in der Zeile MO Start, Ende, Pause, Arbeitszeit oder Überstunden eingibst, wird der Wert automatisch auf alle Tage übernommen.
            </p>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[46px_96px_1fr_1fr_1fr_1fr_1fr_2fr] gap-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700 md:grid">
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
                    ? 'border-sky-200/70 bg-white/80'
                    : 'border-cyan-200/70 bg-cyan-50/65'
                }`}
              >
                <div className="grid gap-2 md:grid-cols-[46px_96px_1fr_1fr_1fr_1fr_1fr_2fr]">
                  <div className="space-y-1">
                    <Label htmlFor={`row-day-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
                      Tag
                    </Label>
                    <Input id={`row-day-${row.day}`} value={row.day} readOnly className="border-sky-200 bg-sky-100/90" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-date-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
                      Datum
                    </Label>
                    <Input id={`row-date-${row.day}`} value={row.date} readOnly className="border-sky-200 bg-sky-100/90" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`row-start-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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
                    <Label htmlFor={`row-end-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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
                    <Label htmlFor={`row-break-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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
                    <Label htmlFor={`row-work-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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
                    <Label htmlFor={`row-over-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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
                    <Label htmlFor={`row-note-${row.day}`} className="text-[11px] text-sky-700 md:hidden">
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-sm text-sky-900">
              Stunden gesamt: <span className="font-semibold">{totalWorkHours}</span>
            </p>
            <Button type="button" onClick={() => void handleDownloadPdf()} disabled={isPdfBusy || !selectedDriverId}>
              {showPdfSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPdfBusy ? 'PDF wird erstellt...' : 'Stundenzettel als PDF erstellen'}
            </Button>
          </div>

          {pdfError ? <p className="text-sm text-red-600">{pdfError}</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}
