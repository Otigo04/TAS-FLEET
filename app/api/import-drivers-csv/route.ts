import { NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/tenant'
import { parseDriversCsv } from '@/lib/driver-csv-parser'

export const runtime = 'nodejs'

type DriverInsert = Database['public']['Tables']['drivers']['Insert']

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
      return NextResponse.json({ error: 'Bitte eine CSV-Datei auswaehlen.' }, { status: 400 })
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei ist zu gross (max. 8 MB).' }, { status: 400 })
    }

    const text = await file.text()
    const parsed = parseDriversCsv(text)

    if (parsed.records.length === 0) {
      return NextResponse.json(
        {
          error: parsed.warnings[0] ?? 'Keine importierbaren Zeilen in der CSV gefunden.',
          warnings: parsed.warnings,
          skipped: parsed.skipped,
          detectedColumns: parsed.detectedColumns,
        },
        { status: 400 }
      )
    }

    // Bestehende Namen laden, um Dubletten beim erneuten Import zu vermeiden.
    const { data: existing, error: existingError } = await supabase
      .from('drivers')
      .select('name')
      .eq('company_id', activeCompany.id)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    const existingNames = new Set((existing ?? []).map((d) => normalizeName(d.name)))

    const skipped = [...parsed.skipped]
    const toInsert: DriverInsert[] = []
    const seenInBatch = new Set<string>()

    for (const record of parsed.records) {
      const key = normalizeName(record.name)
      if (existingNames.has(key) || seenInBatch.has(key)) {
        skipped.push({ row: 0, reason: `Bereits vorhanden, uebersprungen: ${record.name}` })
        continue
      }
      seenInBatch.add(key)

      toInsert.push({
        company_id: activeCompany.id,
        name: record.name,
        first_name: record.first_name,
        last_name: record.last_name,
        street: record.street,
        street_number: record.street_number,
        postal_code: record.postal_code,
        city: record.city,
        birth_date: record.birth_date,
        nationality: record.nationality,
        marital_status: record.marital_status,
        tax_class: record.tax_class,
        tax_id: record.tax_id,
        social_security_number: record.social_security_number,
        health_insurance: record.health_insurance,
        employment_start_date: record.employment_start_date,
        employed_as: record.employed_as,
        bank_name: record.bank_name,
        iban: record.iban,
        district: record.district,
        pschein_valid_until: record.pschein_valid_until,
        current_shift: record.current_shift,
        notes: record.notes,
      })
    }

    let created = 0
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('drivers')
        .insert(toInsert)
        .select('id')

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }

      created = inserted?.length ?? 0
    }

    return NextResponse.json({
      created,
      skipped,
      totalRows: parsed.totalRows,
      warnings: parsed.warnings,
      detectedColumns: parsed.detectedColumns,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim CSV-Import.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
