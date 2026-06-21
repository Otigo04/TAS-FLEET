import { createRequire } from 'node:module'
import { PDFDocument } from 'pdf-lib'
import { createWorker } from 'tesseract.js'

export interface ParsedDriverSheet {
  name: string | null
  firstName: string | null
  lastName: string | null
  streetAndNumber: string | null
  postalCodeAndCity: string | null
  street: string | null
  streetNumber: string | null
  postalCode: string | null
  city: string | null
  birthDate: string | null
  nationality: string | null
  maritalStatus: string | null
  taxClass: string | null
  taxId: string | null
  socialSecurityNumber: string | null
  healthInsurance: string | null
  employmentStartDate: string | null
  employedAs: string | null
  bankName: string | null
  iban: string | null
  pscheinValidUntil: string | null
  district: string | null
  shift: 'Frueh' | 'Spaet' | 'Nacht' | null
  notes: string[]
  warnings: string[]
  rawText: string
}

export type ParsedFieldHints = Record<string, string>

const keyValuePattern = /^\s*([^:\n]{2,40})\s*[:\-]\s*(.+)\s*$/i
const labelTokenBlacklist = [
  'name',
  'vorname',
  'nachname',
  'strasse',
  'straße',
  'strassennr',
  'hausnummer',
  'plz',
  'ort',
  'geburtsdatum',
  'staatsangehorigkeit',
  'familienstand',
  'steuerklasse',
  'steuer',
  'sozialversicherungsnummer',
  'krankenkasse',
  'eintritt',
  'beschaftigt',
  'bank',
  'iban',
  'p-schein',
  'pschein',
  'bezirk',
  'schicht',
  'personliche angaben',
  'persoenliche angaben',
  'steuer und sozialversicherungsrechtliche angaben',
  'kinderfreibetrag',
  'bereich',
  'steuer identifikationsnummer',
  'sozialversicherungsnummer',
  'bankverbindung',
]
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  data: Buffer,
  options?: Record<string, unknown>
) => Promise<{ text?: string }>

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeKey(value: string) {
  return normalizeForSearch(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isLikelyLabelText(value: string) {
  const normalized = normalizeForSearch(value)
  if (!normalized) return true
  if (normalized.endsWith(':')) return true
  if (normalized.length < 2) return true

  return labelTokenBlacklist.some((token) => normalized === token || normalized.startsWith(`${token} `) || normalized.includes(`${token}:`))
}

function isLikelyPersonName(value: string) {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned || isLikelyLabelText(cleaned)) return false
  if (/[0-9]/.test(cleaned)) return false
  if (!/[A-Za-zÄÖÜäöüß]/.test(cleaned)) return false

  const normalized = normalizeForSearch(cleaned)
  if (normalized.includes('strasse') || normalized.includes('plz') || normalized.includes('steuer')) return false

  return true
}

function isLikelyNamePart(value: string | null) {
  if (!value) return false
  const cleaned = normalizeWhitespace(value)
  if (!cleaned || isLikelyLabelText(cleaned)) return false
  if (/[0-9]/.test(cleaned)) return false
  return /[A-Za-zÄÖÜäöüß]/.test(cleaned)
}

function equalsNormalized(a: string | null, b: string | null) {
  if (!a || !b) return false
  return normalizeForSearch(a) === normalizeForSearch(b)
}

function normalizeTaxClass(value: string | null) {
  if (!value) return null
  const compact = normalizeWhitespace(value).replace(/\s+/g, '')
  if (/^[1-6]$/.test(compact)) return compact

  const map: Record<string, string> = {
    i: '1',
    ii: '2',
    iii: '3',
    iv: '4',
    v: '5',
    vi: '6',
  }

  const roman = map[normalizeForSearch(compact)]
  return roman ?? null
}

function normalizeStreet(value: string | null) {
  if (!value) return null
  const cleaned = sanitizeExtractedValue(value)
  if (!cleaned) return null
  if (!/[A-Za-zÄÖÜäöüß]/.test(cleaned)) return null
  return cleaned
}

function sanitizeExtractedValue(value: string | null) {
  if (!value) return null
  const cleaned = normalizeWhitespace(value)
  if (!cleaned || isLikelyLabelText(cleaned)) return null
  return cleaned
}

function findHintValue(hints: ParsedFieldHints, labels: string[]) {
  const entries = Object.entries(hints)
  const normalizedLabels = labels.map((label) => normalizeKey(label))

  for (const label of normalizedLabels) {
    for (const [key, value] of entries) {
      if (!key || !value) continue
      if (key === label || key.includes(label) || label.includes(key)) {
        const candidate = sanitizeExtractedValue(value)
        if (candidate) return candidate
      }
    }
  }

  return null
}

function extractWithRegex(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*(?:[:\\-]|\\s)\\s*([^\\n\\r]{2,140})`, 'i')
    const match = text.match(pattern)
    if (!match) continue
    const candidate = sanitizeExtractedValue(match[1])
    if (candidate) return candidate
  }

  return null
}

function splitColumns(line: string) {
  return line
    .split(/\s{2,}|\t+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
}

function extractFromHeaderValueRows(lines: string[]) {
  const result: Record<string, string> = {}

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = normalizeForSearch(lines[index])
    const valueLine = lines[index + 1]

    const headerCols = splitColumns(lines[index])
    const valueCols = splitColumns(valueLine)
    if (headerCols.length < 2 || valueCols.length < 2 || headerCols.length !== valueCols.length) {
      continue
    }

    const hasCombinedName = headerLine.includes('name/vorname') || headerLine.includes('name vorname')
    const hasSeparatedName =
      headerCols.some((col) => normalizeForSearch(col) === 'name') &&
      headerCols.some((col) => normalizeForSearch(col).includes('vorname'))

    if (!hasCombinedName && !hasSeparatedName) {
      continue
    }

    for (let col = 0; col < Math.min(headerCols.length, valueCols.length); col += 1) {
      if (isLikelyLabelText(valueCols[col])) {
        continue
      }
      result[normalizeForSearch(headerCols[col])] = valueCols[col]
    }
  }

  return result
}

// ---------- Split-column PDF support ----------
// Some PDF renderers output all left-column labels first, then all right-column
// values (column-by-column). buildSplitColumnMap detects such blocks and pairs
// them positionally so Vorname, Identifikationsnummer etc. can be found.

const personalstammblattLabelSet = new Set([
  'kunde', 'name', 'vorname', 'nachname',
  'strasse/nr', 'straße/nr', 'strasse', 'straße', 'anschrift', 'adresse',
  'plz/ort', 'plz ort', 'plz', 'ort', 'stadt',
  'geburtsdatum', 'geburtsort/land', 'geburtsort', 'geburtsname',
  'staatsangehorigkeit', 'staatsangehörigkeit',
  'familienstand', 'steuerklasse', 'kinderfreibetrag', 'kirchensteuer',
  'identifikationsnummer',
  'steuer identifikationsnummer', 'steueridentifikationsnummer',
  'sozialversicherungsnr', 'sozialversicherungsnummer',
  'krankenkasse',
  'eintritt am', 'eintrittsdatum',
  'beschäftigt als', 'beschaftigt als',
  'vertragsform',
  'wochentliche stundenzahl', 'wöchentliche stundenzahl',
  'befristet / unbefristet', 'befristet',
  'renteversicherungsbefreiung liegt vor', 'renteversicherungsbefreiung',
  'kontoinhaber', 'name der bank', 'bankname', 'iban',
  'p-schein', 'pschein', 'bezirk', 'schicht',
])

function isPersonalstammblattLabel(line: string): boolean {
  const stripped = normalizeForSearch(normalizeWhitespace(line))
    .replace(/[\s:/.(]+$/, '')
    .trim()
  return personalstammblattLabelSet.has(stripped)
}

function isFormSectionHeader(line: string): boolean {
  const norm = normalizeForSearch(normalizeWhitespace(line))
  return (
    norm === 'personalstammblatt' ||
    norm.includes('persönliche angaben') ||
    norm.includes('personliche angaben') ||
    norm.includes('steuer und sozialversicherung') ||
    norm.includes('steuer- und sozialversicherung') ||
    norm.includes('angaben zum beschäftigung') ||
    norm.includes('angaben zum beschaftigung') ||
    norm.includes('bankverbindung')
  )
}

function buildSplitColumnMap(lines: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  let i = 0

  while (i < lines.length) {
    const currentLine = normalizeWhitespace(lines[i])

    if (!currentLine || isFormSectionHeader(currentLine)) {
      i++
      continue
    }

    if (!isPersonalstammblattLabel(currentLine)) {
      i++
      continue
    }

    // Check if the next non-empty, non-header line is ALSO a label.
    // That is the indicator of split-column PDF output.
    let peekIndex = i + 1
    while (peekIndex < lines.length && (!normalizeWhitespace(lines[peekIndex]) || isFormSectionHeader(normalizeWhitespace(lines[peekIndex])))) {
      peekIndex++
    }
    const peekLine = normalizeWhitespace(lines[peekIndex] ?? '')
    if (!peekLine || !isPersonalstammblattLabel(peekLine)) {
      // Not split-column for this label; let existing logic handle it.
      i++
      continue
    }

    // Collect consecutive known-label lines (skipping section headers).
    const labelBlock: string[] = []
    let j = i
    while (j < lines.length) {
      const line = normalizeWhitespace(lines[j])
      if (!line) { j++; continue }
      if (isFormSectionHeader(line)) { j++; break }
      if (isPersonalstammblattLabel(line)) {
        labelBlock.push(line)
        j++
      } else {
        break
      }
    }

    if (labelBlock.length < 2) {
      i = j
      continue
    }

    // Skip any section headers immediately after the label block.
    while (j < lines.length && isFormSectionHeader(normalizeWhitespace(lines[j]))) {
      j++
    }

    // Collect values – everything that is NOT a label and NOT a section header.
    // Empty lines are preserved as empty-string values to maintain positional alignment.
    const valueBlock: string[] = []
    let k = j
    while (k < lines.length && valueBlock.length < labelBlock.length) {
      const line = normalizeWhitespace(lines[k])
      if (isFormSectionHeader(line)) break
      if (isPersonalstammblattLabel(line)) break
      valueBlock.push(line)
      k++
    }

    // Pair labels with values positionally.
    for (let m = 0; m < Math.min(labelBlock.length, valueBlock.length); m++) {
      const key = normalizeKey(labelBlock[m])
      const value = valueBlock[m]
      if (key && value && !result[key]) {
        result[key] = value
      }
    }

    i = Math.max(j, i + 1)
  }

  return result
}
// -----------------------------------------------

function extractIban(text: string) {
  const compact = text.replace(/\s+/g, '')
  const match = compact.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/i)
  return match ? match[1].toUpperCase() : null
}

function findNameCandidate(lines: string[]) {
  for (const line of lines.slice(0, 40)) {
    const cleaned = normalizeWhitespace(line)
    if (!isLikelyPersonName(cleaned)) continue

    const words = cleaned.split(' ').filter(Boolean)
    if (words.length >= 2 && words.length <= 5) {
      return cleaned
    }
  }

  return null
}

function parseDateToken(value: string): string | null {
  const directIso = value.match(/\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/)
  if (directIso) {
    const [, year, month, day] = directIso
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const dmy = value.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/)
  if (!dmy) {
    return null
  }

  let [, day, month, year] = dmy
  if (year.length === 2) {
    year = `20${year}`
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function toNull(value: string | null) {
  if (!value) return null
  const cleaned = normalizeWhitespace(value)
  return cleaned.length > 0 ? cleaned : null
}

function detectShift(value: string): 'Frueh' | 'Spaet' | 'Nacht' | null {
  const normalized = normalizeForSearch(value)

  if (normalized.includes('fruh') || normalized.includes('frueh') || normalized.includes('fruehschicht')) {
    return 'Frueh'
  }

  if (normalized.includes('spat') || normalized.includes('spaet') || normalized.includes('spaetschicht')) {
    return 'Spaet'
  }

  if (normalized.includes('nacht') || normalized.includes('nachtschicht')) {
    return 'Nacht'
  }

  return null
}

function findValueForLabels(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map((label) => normalizeForSearch(label))

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const normalizedLine = normalizeForSearch(line)
    const pair = line.match(keyValuePattern)
    const value = pair ? normalizeWhitespace(pair[2]) : ''

    for (const label of normalizedLabels) {
      if (!normalizedLine.includes(label)) {
        continue
      }

      if (value && !isLikelyLabelText(value)) {
        return value
      }

      const parts = line.split(/[:\-]/)
      if (parts.length > 1) {
        const candidate = normalizeWhitespace(parts.slice(1).join(' '))
        if (!isLikelyLabelText(candidate)) {
          return candidate
        }
      }

      const labelOnly = normalizeWhitespace(line)
      if (normalizedLabels.some((labelText) => normalizeForSearch(labelOnly) === labelText)) {
        const nextLine = lines[index + 1]
        if (nextLine && !isLikelyLabelText(nextLine)) {
          return normalizeWhitespace(nextLine)
        }
      }

      const raw = normalizeWhitespace(line)
      const fallback = raw.replace(new RegExp(label, 'i'), '').trim()
      return fallback && !isLikelyLabelText(fallback) ? fallback : null
    }
  }

  return null
}

function extractStreetAndNumber(value: string | null) {
  if (!value) {
    return { street: null, streetNumber: null }
  }

  const trimmed = normalizeWhitespace(value)
  const match = trimmed.match(/^(.*?)(\d+[a-zA-Z\-\/]*)$/)

  if (!match) {
    return { street: trimmed, streetNumber: null }
  }

  return {
    street: normalizeWhitespace(match[1]),
    streetNumber: normalizeWhitespace(match[2]),
  }
}

function splitPostalCodeAndCity(value: string | null) {
  if (!value) {
    return { postalCode: null, city: null }
  }

  const match = value.match(/\b(\d{4,5})\b\s*(.*)$/)
  if (!match) {
    return { postalCode: null, city: normalizeWhitespace(value) }
  }

  return {
    postalCode: match[1],
    city: normalizeWhitespace(match[2]),
  }
}

function parseCombinedName(value: string | null) {
  if (!value) {
    return { firstName: null, lastName: null }
  }

  const cleaned = normalizeWhitespace(value)
  if (cleaned.includes(',')) {
    const [lastName, firstName] = cleaned.split(',').map((part) => normalizeWhitespace(part))
    return { firstName: firstName || null, lastName: lastName || null }
  }

  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length < 2) {
    return { firstName: null, lastName: cleaned }
  }

  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  }
}

function extractKeyValueNotes(lines: string[], ignoredKeys: string[]) {
  const ignored = ignoredKeys.map((value) => normalizeForSearch(value))

  return lines
    .map((line) => line.match(keyValuePattern))
    .filter((pair): pair is RegExpMatchArray => Boolean(pair))
    .map((pair) => ({ key: normalizeWhitespace(pair[1]), value: normalizeWhitespace(pair[2]) }))
    .filter(({ key, value }) => {
      if (!value) {
        return false
      }
      if (isLikelyLabelText(key) || isLikelyLabelText(value)) {
        return false
      }
      const normalizedKey = normalizeForSearch(key)
      return !ignored.some((term) => normalizedKey.includes(term))
    })
    .map(({ key, value }) => `${key}: ${value}`)
}

export async function extractTextFromSheet(fileName: string, bytes: Buffer) {
  const lower = fileName.toLowerCase()

  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(bytes)
    return parsed.text ?? ''
  }

  const worker = await createWorker('deu+eng')
  try {
    const {
      data: { text },
    } = await worker.recognize(bytes)
    return text ?? ''
  } finally {
    await worker.terminate()
  }
}

export async function extractPdfFormFieldHints(fileName: string, bytes: Buffer): Promise<ParsedFieldHints> {
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return {}
  }

  try {
    const pdf = await PDFDocument.load(bytes)
    const form = pdf.getForm()
    const fields = form.getFields()
    const hints: ParsedFieldHints = {}

    for (const field of fields) {
      const key = normalizeKey(field.getName())
      if (!key) continue

      let value = ''
      const dynamicField = field as unknown as {
        getText?: () => string
        getSelected?: () => string[]
        isChecked?: () => boolean
      }

      try {
        if (typeof dynamicField.getText === 'function') {
          value = dynamicField.getText() ?? ''
        } else if (typeof dynamicField.getSelected === 'function') {
          value = (dynamicField.getSelected() ?? []).join(' ')
        } else if (typeof dynamicField.isChecked === 'function') {
          value = dynamicField.isChecked() ? 'ja' : 'nein'
        }
      } catch {
        value = ''
      }

      const cleaned = sanitizeExtractedValue(value)
      if (cleaned) {
        hints[key] = cleaned
      }
    }

    return hints
  } catch {
    return {}
  }
}

export function parseDriverSheetText(text: string, hints: ParsedFieldHints = {}): ParsedDriverSheet {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  const warnings: string[] = []
  const rowMapped = extractFromHeaderValueRows(lines)
  const columnMap = buildSplitColumnMap(lines)

  const firstNameRaw =
    findHintValue(hints, ['vorname', 'first name', 'vornarne', 'vor narne', 'vorname / first name']) ||
    rowMapped['vorname'] ||
    rowMapped['first name'] ||
    columnMap['vorname'] ||
    findValueForLabels(lines, ['vorname', 'first name', 'vornarne', 'vor narne', 'vorname / first name']) ||
    extractWithRegex(text, ['Vorname', 'First Name', 'Vornarne', 'Vorname / First name']) ||
    null
  const lastNameRaw =
    findHintValue(hints, ['nachname', 'surname', 'last name']) ||
    rowMapped['name'] ||
    rowMapped['nachname'] ||
    columnMap['name'] ||
    findValueForLabels(lines, ['nachname', 'name', 'surname', 'last name']) ||
    extractWithRegex(text, ['Nachname', 'Surname', 'Last Name']) ||
    null
  const combinedName =
    findHintValue(hints, ['name vorname', 'nachname vorname']) ||
    findValueForLabels(lines, ['name vorname', 'nachname vorname'])
  const fullName =
    findHintValue(hints, ['name, vorname', 'name vorname', 'nachname, vorname', 'nachname vorname']) ||
    findValueForLabels(lines, ['name, vorname', 'name vorname', 'nachname, vorname', 'nachname vorname'])

  const combined = parseCombinedName(combinedName)
  let firstName = toNull(firstNameRaw ?? combined.firstName)
  let lastName = toNull(lastNameRaw ?? combined.lastName)

  if (!isLikelyNamePart(firstName)) firstName = null
  if (!isLikelyNamePart(lastName)) lastName = null

  if (equalsNormalized(firstName, lastName)) {
    // firstName = null
  }

  const mergedName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const fallbackName = sanitizeExtractedValue(fullName ?? extractWithRegex(text, ['Name/Vorname', 'Name Vorname']))
  const name =
    (mergedName && isLikelyPersonName(mergedName) ? mergedName : null) ||
    (fallbackName && isLikelyPersonName(fallbackName) ? fallbackName : null)

  if (!name) {
    warnings.push('Name konnte nicht sicher erkannt werden.')
  }

  const district = sanitizeExtractedValue(
    findHintValue(hints, ['bezirk', 'einsatzbezirk', 'standort', 'gebiet']) ||
      findValueForLabels(lines, ['bezirk', 'einsatzbezirk', 'standort', 'gebiet']) ||
      extractWithRegex(text, ['Bezirk', 'Einsatzbezirk', 'Standort'])
  )
  if (!district) {
    warnings.push('Bezirk wurde nicht erkannt. Fallback wird verwendet.')
  }

  const streetRaw = sanitizeExtractedValue(
    findHintValue(hints, ['strasse', 'straße', 'anschrift', 'adresse', 'strasse nr', 'straße nr']) ||
      findValueForLabels(lines, ['strasse', 'straße', 'anschrift', 'adresse']) ||
      extractWithRegex(text, ['Straße/Nr.', 'Strasse/Nr.', 'Straße', 'Strasse', 'Anschrift']) ||
      rowMapped['strasse/nr.'] ||
      rowMapped['straße/nr.'] ||
      null
  )
  const streetNumberRaw = sanitizeExtractedValue(
    findHintValue(hints, ['strassennr', 'strassennummer', 'hausnummer', 'nr']) ||
      findValueForLabels(lines, ['strassennr', 'strassennummer', 'hausnummer', 'nr']) ||
      extractWithRegex(text, ['Straßennr', 'Strassennr', 'Hausnummer'])
  )
  const { street, streetNumber: derivedStreetNumber } = extractStreetAndNumber(streetRaw)
  const normalizedStreet = normalizeStreet(street)
  const streetNumber = sanitizeExtractedValue(streetNumberRaw ?? derivedStreetNumber)

  const postalCodeRaw = sanitizeExtractedValue(
    findHintValue(hints, ['plz', 'postleitzahl']) ||
      findValueForLabels(lines, ['plz', 'postleitzahl']) ||
      extractWithRegex(text, ['PLZ', 'Postleitzahl'])
  )
  const cityRaw = sanitizeExtractedValue(
    findHintValue(hints, ['ort', 'stadt']) ||
      findValueForLabels(lines, ['ort', 'stadt']) ||
      extractWithRegex(text, ['Ort', 'Stadt'])
  )
  const plzCityRaw = sanitizeExtractedValue(
    findValueForLabels(lines, ['plz ort', 'postleitzahl ort']) ||
      extractWithRegex(text, ['PLZ/Ort', 'PLZ Ort']) ||
      rowMapped['plz/ort'] ||
      null
  )
  const combinedPlzCity = splitPostalCodeAndCity(plzCityRaw)
  const postalCode = toNull(postalCodeRaw ?? combinedPlzCity.postalCode)
  const city = toNull(cityRaw ?? combinedPlzCity.city)

  const birthDateRaw =
    findHintValue(hints, ['geburtsdatum', 'geb.']) ||
    findValueForLabels(lines, ['geburtsdatum', 'geb.']) ||
    extractWithRegex(text, ['Geburtsdatum', 'Geb.'])
  const birthDate = birthDateRaw ? parseDateToken(birthDateRaw) : null

  const nationality = sanitizeExtractedValue(
    findHintValue(hints, ['staatsangehorigkeit', 'staatsangehörigkeit']) ||
      findValueForLabels(lines, ['staatsangehorigkeit', 'staatsangehörigkeit']) ||
      extractWithRegex(text, ['Staatsangehörigkeit', 'Staatsangehorigkeit'])
  )
  const maritalStatus = sanitizeExtractedValue(
    findHintValue(hints, ['familienstand']) ||
      findValueForLabels(lines, ['familienstand']) ||
      extractWithRegex(text, ['Familienstand'])
  )
  const taxClassRaw = sanitizeExtractedValue(
    findHintValue(hints, ['steuerklasse']) ||
      findValueForLabels(lines, ['steuerklasse']) ||
      extractWithRegex(text, ['Steuerklasse'])
  )
  const taxClass = normalizeTaxClass(taxClassRaw)
  const taxId = toNull(
    sanitizeExtractedValue(
      findHintValue(hints, ['identifikationsnummer', 'steuer identifikationsnummer', 'steuer-id', 'steuer id', 'steueridentifikationsnummer', 'steuernummer', 'steuer-nr', 'steuernr']) ||
        columnMap['identifikationsnummer'] ||
        columnMap['steuer identifikationsnummer'] ||
        findValueForLabels(lines, ['identifikationsnummer', 'steuer identifikationsnummer', 'steuer-id', 'steuer id', 'steueridentifikationsnummer', 'steuernummer', 'steuer-nr', 'steuernr']) ||
        extractWithRegex(text, ['Identifikationsnummer', 'Steuer Identifikationsnummer', 'Steuer-ID', 'Steuer ID', 'Steuernummer', 'Steuer-Nr', 'Steuernr'])
    )
  )
  const socialSecurityNumber = toNull(
    sanitizeExtractedValue(
      findHintValue(hints, ['sozialversicherungsnr', 'sozialversicherungsnummer', 'sv-nummer', 'sv nummer']) ||
        columnMap['sozialversicherungsnr'] ||
        columnMap['sozialversicherungsnummer'] ||
        findValueForLabels(lines, ['sozialversicherungsnr', 'sozialversicherungsnummer', 'sv-nummer', 'sv nummer']) ||
        extractWithRegex(text, ['Sozialversicherungsnr', 'Sozialversicherungsnummer', 'SV-Nummer'])
    )
  )
  const healthInsurance = sanitizeExtractedValue(
    findHintValue(hints, ['krankenkasse']) ||
      findValueForLabels(lines, ['krankenkasse']) ||
      extractWithRegex(text, ['Krankenkasse'])
  )

  const employmentStartDateRaw =
    findHintValue(hints, ['eintritt am', 'eintrittsdatum', 'eintritt']) ||
    findValueForLabels(lines, ['eintritt am', 'eintrittsdatum', 'eintritt']) ||
    extractWithRegex(text, ['Eintritt am', 'Eintrittsdatum', 'Eintritt'])
  const employmentStartDate = employmentStartDateRaw ? parseDateToken(employmentStartDateRaw) : null
  const employedAs = sanitizeExtractedValue(
    findValueForLabels(lines, ['beschaftigt als', 'beschäftigt als', 'taetigkeit', 'tätigkeit']) ||
      findHintValue(hints, ['beschaftigt als', 'beschäftigt als', 'taetigkeit', 'tätigkeit']) ||
      extractWithRegex(text, ['Beschäftigt als', 'Beschaftigt als', 'Tätigkeit', 'Taetigkeit'])
  )
  const bankName = sanitizeExtractedValue(
    findHintValue(hints, ['name der bank', 'bankname']) ||
      findValueForLabels(lines, ['name der bank', 'bankname']) ||
      extractWithRegex(text, ['Name der Bank', 'Bankname'])
  )
  const iban = sanitizeExtractedValue(findHintValue(hints, ['iban']) || findValueForLabels(lines, ['iban']) || extractIban(text))

  const pscheinRaw = findValueForLabels(lines, [
    'p-schein',
    'personenbeforderungsschein',
    'personenbefoerderungsschein',
    'pschein',
  ])
  const pscheinValidUntil = pscheinRaw ? parseDateToken(pscheinRaw) : null
  if (!pscheinValidUntil) {
    warnings.push('P-Schein-Datum wurde nicht erkannt. Bitte prüfen.')
  }

  const shiftRaw = findValueForLabels(lines, ['schicht', 'dienst'])
  const shift = shiftRaw ? detectShift(shiftRaw) : detectShift(lines.join(' '))

  const notes = extractKeyValueNotes(lines, [
    'name',
    'name vorname',
    'nachname vorname',
    'vorname',
    'nachname',
    'first name',
    'last name',
    'surname',
    'bezirk',
    'einsatzbezirk',
    'standort',
    'gebiet',
    'strasse',
    'straße',
    'strassennr',
    'strassennummer',
    'hausnummer',
    'plz',
    'postleitzahl',
    'ort',
    'stadt',
    'geburtsdatum',
    'staatsangehorigkeit',
    'staatsangehörigkeit',
    'familienstand',
    'steuerklasse',
    'steuer identifikationsnummer',
    'steuer-id',
    'steuer id',
    'steueridentifikationsnummer',
    'sozialversicherungsnummer',
    'sv-nummer',
    'sv nummer',
    'krankenkasse',
    'eintritt am',
    'eintrittsdatum',
    'eintritt',
    'beschaftigt als',
    'beschäftigt als',
    'taetigkeit',
    'tätigkeit',
    'name der bank',
    'bank',
    'bankname',
    'iban',
    'p-schein',
    'personenbeforderungsschein',
    'personenbefoerderungsschein',
    'pschein',
    'schicht',
    'dienst',
  ]).slice(0, 8)

  return {
    name,
    firstName,
    lastName,
    streetAndNumber: [normalizedStreet, streetNumber].filter(Boolean).join(' '),
    postalCodeAndCity: [postalCode, city].filter(Boolean).join(' '),
    street: normalizedStreet,
    streetNumber,
    postalCode,
    city,
    birthDate,
    nationality,
    maritalStatus,
    taxClass,
    taxId,
    socialSecurityNumber,
    healthInsurance,
    employmentStartDate,
    employedAs,
    bankName,
    iban,
    district,
    pscheinValidUntil,
    shift,
    notes,
    warnings,
    rawText: text,
  }
}
