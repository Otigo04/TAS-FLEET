/**
 * Einmaliges Migrationsskript: verschiebt bestehende Avatar-/Logo-Bilder, die
 * als Data-URL direkt in DB-Spalten liegen, in den `avatars`-Storage-Bucket
 * und ersetzt den Spaltenwert durch die öffentliche URL.
 *
 * Ausführen (nach Deploy von Migration 0015):
 *   node scripts/migrate-avatars.mjs
 *
 * Benötigt in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// .env.local minimal einlesen (kein dotenv nötig).
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // .env.local optional, falls Variablen schon gesetzt sind
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Fehlt: NEXT_PUBLIC_SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET = 'avatars'
const targets = [
  { table: 'drivers', column: 'avatar_url', prefix: 'drivers' },
  { table: 'vehicles', column: 'avatar_url', prefix: 'vehicles' },
  { table: 'profiles', column: 'avatar_url', prefix: 'profiles' },
  { table: 'companies', column: 'logo_url', prefix: 'companies' },
]

function parseDataUrl(value) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value)
  if (!m) return null
  const mime = m[1] || 'image/jpeg'
  const isBase64 = Boolean(m[2])
  const data = m[3]
  const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8')
  const ext = mime.split('/')[1]?.split('+')[0] || 'jpg'
  return { mime, buffer, ext }
}

async function migrateTarget({ table, column, prefix }) {
  const { data: rows, error } = await supabase.from(table).select(`id, ${column}`)
  if (error) {
    console.error(`[${table}] Lesefehler:`, error.message)
    return
  }
  let migrated = 0
  for (const row of rows ?? []) {
    const value = row[column]
    if (typeof value !== 'string' || !value.startsWith('data:')) continue
    const parsed = parseDataUrl(value)
    if (!parsed) continue

    const path = `${prefix}/${row.id}.${parsed.ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: true })
    if (upErr) {
      console.error(`[${table}:${row.id}] Upload-Fehler:`, upErr.message)
      continue
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: updErr } = await supabase
      .from(table)
      .update({ [column]: pub.publicUrl })
      .eq('id', row.id)
    if (updErr) {
      console.error(`[${table}:${row.id}] Update-Fehler:`, updErr.message)
      continue
    }
    migrated += 1
  }
  console.log(`[${table}] ${migrated} Bild(er) migriert.`)
}

for (const target of targets) {
  await migrateTarget(target)
}
console.log('Fertig.')
