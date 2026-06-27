// Generischer CSV-Massenimport fuer Fahrer.
// Mappt frei benannte Spaltenkoepfe (DE/EN) auf das drivers-Schema.
// Unbekannte, aber befuellte Spalten landen als "Label: Wert" in notes.

export interface CsvDriverRecord {
  name: string
  first_name: string | null
  last_name: string | null
  street: string | null
  street_number: string | null
  postal_code: string | null
  city: string | null
  birth_date: string | null
  nationality: string | null
  marital_status: string | null
  tax_class: string | null
  tax_id: string | null
  social_security_number: string | null
  health_insurance: string | null
  employment_start_date: string | null
  employed_as: string | null
  bank_name: string | null
  iban: string | null
  pschein_valid_until: string | null
  district: string | null
  current_shift: 'Frueh' | 'Spaet' | 'Nacht'
  notes: string[]
}

export interface CsvParseResult {
  records: CsvDriverRecord[]
  totalRows: number
  skipped: { row: number; reason: string }[]
  warnings: string[]
  detectedColumns: string[]
}

type DriverField = Exclude<keyof CsvDriverRecord, 'notes' | 'name' | 'current_shift'>

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Bekannte Spaltenkoepfe -> drivers-Feld. Reihenfolge egal, Matching exakt nach Normalisierung.
const COLUMN_TO_FIELD: Record<string, DriverField | 'name' | 'shift'> = {
  'name des fahrers': 'name',
  'name': 'name',
  'fahrer': 'name',
  'fahrername': 'name',
  'vollstandiger name': 'name',
  'anzeigename': 'name',
  'vorname': 'first_name',
  'first name': 'first_name',
  'nachname': 'last_name',
  'last name': 'last_name',
  'surname': 'last_name',
  'strasse': 'street',
  'strasse nr': 'street',
  'street': 'street',
  'hausnummer': 'street_number',
  'strassennr': 'street_number',
  'nr': 'street_number',
  'plz': 'postal_code',
  'postleitzahl': 'postal_code',
  'ort': 'city',
  'stadt': 'city',
  'city': 'city',
  'geburtsdatum': 'birth_date',
  'geb': 'birth_date',
  'staatsangehorigkeit': 'nationality',
  'familienstand': 'marital_status',
  'steuerklasse': 'tax_class',
  'steuer id': 'tax_id',
  'steueridentifikationsnummer': 'tax_id',
  'steuer identifikationsnummer': 'tax_id',
  'identifikationsnummer': 'tax_id',
  'sozialversicherungsnummer': 'social_security_number',
  'sozialversicherungsnr': 'social_security_number',
  'sv nummer': 'social_security_number',
  'krankenkasse': 'health_insurance',
  'eintritt am': 'employment_start_date',
  'eintritt': 'employment_start_date',
  'eintrittsdatum': 'employment_start_date',
  'beschaftigt als': 'employed_as',
  'tatigkeit': 'employed_as',
  'name der bank': 'bank_name',
  'bankname': 'bank_name',
  'bank': 'bank_name',
  'iban': 'iban',
  'p schein': 'pschein_valid_until',
  'pschein': 'pschein_valid_until',
  'p schein gultig bis': 'pschein_valid_until',
  'personenbeforderungsschein': 'pschein_valid_until',
  'bezirk': 'district',
  'einsatzbezirk': 'district',
  'gebiet': 'district',
  'district': 'district',
  'schicht': 'shift',
  'dienst': 'shift',
  'shift': 'shift',
}

// Bekannte Zusatzspalten -> als Notiz mit lesbarem Label.
const COLUMN_TO_NOTE: Record<string, string> = {
  'mobilnummer': 'Telefon',
  'telefon': 'Telefon',
  'handy': 'Telefon',
  'telefonnummer': 'Telefon',
  'e mail adresse des fahrers': 'E-Mail',
  'e mail': 'E-Mail',
  'email': 'E-Mail',
  'e mail adresse': 'E-Mail',
  'status': 'Status',
  'echtzeit': 'Echtzeit-Status',
  'fahrer uuid': 'Fahrer-UUID',
  'uuid': 'Fahrer-UUID',
}

// Spalten, die wir bewusst ignorieren (Rauschen / kein Mehrwert).
const IGNORED_COLUMNS = new Set([
  'name des unternehmens',
  'unternehmen',
  'company',
  'zuletzt online',
])

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = -1
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

// RFC4180-naher CSV-Parser: behandelt Quotes, eingebettete Trenner/Zeilenumbrueche und "" als Escape.
function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      field = ''
      row = []
    } else if (char === '\r') {
      // Zeilenende erst am \n verarbeiten.
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function cleanCell(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function parseDateToken(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = trimmed.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const dmy = trimmed.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (dmy) {
    let [, d, m, y] = dmy
    if (y.length === 2) y = `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

function detectShift(value: string): 'Frueh' | 'Spaet' | 'Nacht' | null {
  const n = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  if (n.includes('fruh') || n.includes('frueh') || n.includes('early')) return 'Frueh'
  if (n.includes('spat') || n.includes('spaet') || n.includes('late')) return 'Spaet'
  if (n.includes('nacht') || n.includes('night')) return 'Nacht'
  return null
}

export function parseDriversCsv(text: string): CsvParseResult {
  const stripped = text.replace(/^﻿/, '') // BOM weg
  const firstLine = stripped.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const rows = parseCsvRows(stripped, delimiter)

  const warnings: string[] = []
  const skipped: { row: number; reason: string }[] = []

  if (rows.length === 0) {
    return { records: [], totalRows: 0, skipped, warnings: ['Datei ist leer.'], detectedColumns: [] }
  }

  const headerCells = rows[0].map((cell) => cleanCell(cell))
  const headerKeys = headerCells.map((cell) => normalizeHeader(cell))

  // Spalten ohne erkanntes Mapping und nicht ignoriert -> generische Notiz mit Originalkopf.
  const detectedColumns: string[] = []
  for (let c = 0; c < headerKeys.length; c += 1) {
    const key = headerKeys[c]
    if (!key) continue
    if (COLUMN_TO_FIELD[key]) detectedColumns.push(`${headerCells[c]} → ${COLUMN_TO_FIELD[key]}`)
    else if (COLUMN_TO_NOTE[key]) detectedColumns.push(`${headerCells[c]} → Notiz`)
  }

  const nameColIndex = headerKeys.findIndex((key) => COLUMN_TO_FIELD[key] === 'name')
  if (nameColIndex === -1) {
    warnings.push('Keine Namensspalte gefunden (z. B. "Name des Fahrers"). Import nicht moeglich.')
    return { records: [], totalRows: rows.length - 1, skipped, warnings, detectedColumns }
  }

  const records: CsvDriverRecord[] = []

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r]
    // Komplett leere Zeile ueberspringen.
    if (cells.every((cell) => cleanCell(cell) === '')) continue

    const record: CsvDriverRecord = {
      name: '',
      first_name: null,
      last_name: null,
      street: null,
      street_number: null,
      postal_code: null,
      city: null,
      birth_date: null,
      nationality: null,
      marital_status: null,
      tax_class: null,
      tax_id: null,
      social_security_number: null,
      health_insurance: null,
      employment_start_date: null,
      employed_as: null,
      bank_name: null,
      iban: null,
      pschein_valid_until: null,
      district: null,
      current_shift: 'Frueh',
      notes: [],
    }

    for (let c = 0; c < headerKeys.length; c += 1) {
      const key = headerKeys[c]
      const value = cleanCell(cells[c])
      if (!key || !value) continue
      if (IGNORED_COLUMNS.has(key)) continue

      const field = COLUMN_TO_FIELD[key]
      if (field === 'name') {
        record.name = value
        continue
      }
      if (field === 'shift') {
        const shift = detectShift(value)
        if (shift) record.current_shift = shift
        else record.notes.push(`Schicht (unklar): ${value}`)
        continue
      }
      if (field === 'birth_date' || field === 'employment_start_date' || field === 'pschein_valid_until') {
        const date = parseDateToken(value)
        if (date) record[field] = date
        else record.notes.push(`${COLUMN_TO_FIELD[key]}: ${value}`)
        continue
      }
      if (field) {
        record[field] = value
        continue
      }

      const noteLabel = COLUMN_TO_NOTE[key]
      if (noteLabel) {
        record.notes.push(`${noteLabel}: ${value}`)
      }
    }

    if (!record.name) {
      skipped.push({ row: r + 1, reason: 'Kein Name in dieser Zeile.' })
      continue
    }

    records.push(record)
  }

  return { records, totalRows: rows.length - 1, skipped, warnings, detectedColumns }
}
