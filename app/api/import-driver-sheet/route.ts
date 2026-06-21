import { NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/tenant'
import { extractPdfFormFieldHints, extractTextFromSheet, parseDriverSheetText } from '@/lib/driver-sheet-parser'

export const runtime = 'nodejs'

type DriverInsert = Database['public']['Tables']['drivers']['Insert']

function oneYearFromToday() {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

function normalizeForCompare(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function buildCanonicalName(parsed: {
  name: string | null
  firstName: string | null
  lastName: string | null
}) {
  const first = parsed.firstName?.trim() || ''
  const last = parsed.lastName?.trim() || ''

  if (first && last) {
    if (normalizeForCompare(first) === normalizeForCompare(last)) {
      return last
    }
    return `${first} ${last}`
  }

  if (first) return first
  if (last) return last
  return parsed.name?.trim() || null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
    }

    const activeCompany = await resolveActiveCompany()
    if (!activeCompany) {
      return NextResponse.json({ error: 'Kein aktives Unternehmen gefunden.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Bitte eine Datei auswaehlen.' }, { status: 400 })
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei ist zu gross (max. 12 MB).' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const extractedText = await extractTextFromSheet(file.name, bytes)
    const formFieldHints = await extractPdfFormFieldHints(file.name, bytes)

    if (!extractedText.trim() && Object.keys(formFieldHints).length === 0) {
      return NextResponse.json(
        { error: 'Datei konnte nicht gelesen werden. Bitte besseres PDF/Bild hochladen.' },
        { status: 400 }
      )
    }

    const parsed = parseDriverSheetText(extractedText, formFieldHints)

    const canonicalName = buildCanonicalName(parsed)

    if (!canonicalName || canonicalName.includes(':') || canonicalName.includes('/')) {
      return NextResponse.json(
        {
          error: 'Name/Vorname konnte nicht eindeutig erkannt werden. Bitte PDF pruefen und erneut hochladen.',
          warnings: parsed.warnings,
        },
        { status: 400 }
      )
    }

    const notes = [...parsed.notes]
    notes.push(`Importquelle: ${file.name}`)
    if (parsed.firstName) {
      notes.push(`Vorname erkannt: ${parsed.firstName}`)
    }

    if (!parsed.pscheinValidUntil) {
      notes.push('P-Schein gültig bis: nicht erkannt, bitte manuell aktualisieren')
    }

    if (!parsed.district) {
      notes.push('Bezirk: nicht erkannt, bitte manuell aktualisieren')
    }

    const payload: DriverInsert = {
      company_id: activeCompany.id,
      name: canonicalName,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      street: parsed.street,
      street_number: parsed.streetNumber,
      postal_code: parsed.postalCode,
      city: parsed.city,
      birth_date: parsed.birthDate,
      nationality: parsed.nationality,
      marital_status: parsed.maritalStatus,
      tax_class: parsed.taxClass,
      tax_id: parsed.taxId,
      social_security_number: parsed.socialSecurityNumber,
      health_insurance: parsed.healthInsurance,
      employment_start_date: parsed.employmentStartDate,
      employed_as: parsed.employedAs,
      bank_name: parsed.bankName,
      iban: parsed.iban,
      district: parsed.district ?? 'Unbekannt',
      pschein_valid_until: parsed.pscheinValidUntil ?? oneYearFromToday(),
      current_shift: parsed.shift ?? 'Frueh',
      notes,
    }

    const { data: insertedDriver, error: insertError } = await supabase
      .from('drivers')
      .insert(payload)
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({
      driver: insertedDriver,
      warnings: parsed.warnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim Import.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
