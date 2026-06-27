// =====================================================================
// scripts/seed-demo.mjs
// Erstellt einen vollständig befüllten Demo-/Werbeaccount für TAS FLEET.
//
//   Login:    demo@citydrive-berlin.de  /  CityDrive2026!
//   Firma:    CityDrive Berlin GmbH (Owner = der Login)
//   + Team:   Betriebsleiter (admin), Disponent (member)
//
// Idempotent: bei erneutem Lauf werden die Demo-User und ihre Firmen
// (inkl. aller Daten per ON-DELETE-CASCADE) vorher entfernt.
//
// Business-Inserts laufen über den eingeloggten Owner-Client, damit RLS
// greift und das Audit-Log echte Akteursnamen bekommt.
//
//   node scripts/seed-demo.mjs
// =====================================================================
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ---- .env.local laden -------------------------------------------------
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('❌ Fehlende Keys in .env.local (URL / PUBLISHABLE / SERVICE_ROLE).')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// ---- Helfer -----------------------------------------------------------
const today = new Date('2026-06-26T12:00:00Z')
const iso = (d) => d.toISOString().slice(0, 10)
/** Datum relativ zu heute in Tagen (negativ = Vergangenheit). */
const day = (offset) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return iso(d)
}
const ts = (offsetDays) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}
const ok = (label, error) => {
  if (error) console.log(`  ⚠️  ${label}: ${error.message || error}`)
  else console.log(`  ✅ ${label}`)
  return !error
}

async function findUserByEmail(email) {
  // listUsers paginiert; für eine Handvoll Demo-User reicht Seite 1–3.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

async function purgeUser(email) {
  const u = await findUserByEmail(email)
  if (!u) return
  // Firmen löschen, in denen der User Owner ist -> cascade entfernt alle Daten.
  const { data: memberships } = await admin
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', u.id)
  for (const m of memberships ?? []) {
    if (m.role === 'owner') {
      await admin.from('companies').delete().eq('id', m.company_id)
    }
  }
  await admin.auth.admin.deleteUser(u.id)
  console.log(`  🧹 entfernt: ${email}`)
}

async function createUser(email, password, first, last, avatar) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  const id = data.user.id
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id, first_name: first, last_name: last, role: 'admin', avatar_url: avatar })
  if (pErr) throw new Error(`profile ${email}: ${pErr.message}`)
  return id
}

function signedInClient(email, password) {
  const c = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  return c.auth.signInWithPassword({ email, password }).then(({ error }) => {
    if (error) throw new Error(`signIn ${email}: ${error.message}`)
    return c
  })
}

// ---- Stammdaten -------------------------------------------------------
const CREDS = {
  owner: { email: 'demo@citydrive-berlin.de', password: 'CityDrive2026!', first: 'Max', last: 'Berger', avatar: 'https://i.pravatar.cc/300?img=12' },
  admin: { email: 'leitung@citydrive-berlin.de', password: 'CityDrive2026!', first: 'Sandra', last: 'Krüger', avatar: 'https://i.pravatar.cc/300?img=45' },
  member: { email: 'dispo@citydrive-berlin.de', password: 'CityDrive2026!', first: 'Tobias', last: 'Wagner', avatar: 'https://i.pravatar.cc/300?img=33' },
}

const DRIVERS = [
  { first: 'Erik', last: 'Sahin', img: 11, district: 'Berlin Mitte', shift: 'Frueh', city: 'Berlin', postal: '10115', street: 'Invalidenstraße', nr: '12', nat: 'Deutsch', marital: 'ledig', tax: 'I', employed: 'Vollzeit', pschein: 120 },
  { first: 'Daniel', last: 'Petrov', img: 13, district: 'Friedrichshain', shift: 'Spaet', city: 'Berlin', postal: '10245', street: 'Warschauer Str.', nr: '45', nat: 'Bulgarisch', marital: 'verheiratet', tax: 'III', employed: 'Vollzeit', pschein: 25 },
  { first: 'Murat', last: 'Yıldız', img: 14, district: 'Neukölln', shift: 'Nacht', city: 'Berlin', postal: '12043', street: 'Karl-Marx-Str.', nr: '88', nat: 'Türkisch', marital: 'verheiratet', tax: 'IV', employed: 'Vollzeit', pschein: -8 },
  { first: 'Lukas', last: 'Hoffmann', img: 15, district: 'Charlottenburg', shift: 'Frueh', city: 'Berlin', postal: '10623', street: 'Kantstraße', nr: '120', nat: 'Deutsch', marital: 'ledig', tax: 'I', employed: 'Teilzeit', pschein: 200 },
  { first: 'Ahmed', last: 'Nouri', img: 51, district: 'Kreuzberg', shift: 'Spaet', city: 'Berlin', postal: '10961', street: 'Gneisenaustr.', nr: '7', nat: 'Syrisch', marital: 'ledig', tax: 'I', employed: 'Vollzeit', pschein: 60 },
  { first: 'Jan', last: 'Kowalski', img: 52, district: 'Prenzlauer Berg', shift: 'Frueh', city: 'Berlin', postal: '10405', street: 'Greifswalder Str.', nr: '210', nat: 'Polnisch', marital: 'verheiratet', tax: 'III', employed: 'Vollzeit', pschein: 14 },
  { first: 'Stefan', last: 'Bauer', img: 53, district: 'Spandau', shift: 'Nacht', city: 'Berlin', postal: '13585', street: 'Klosterstraße', nr: '33', nat: 'Deutsch', marital: 'geschieden', tax: 'II', employed: 'Vollzeit', pschein: 320 },
  { first: 'Nikola', last: 'Marković', img: 60, district: 'Tempelhof', shift: 'Spaet', city: 'Berlin', postal: '12099', street: 'Tempelhofer Damm', nr: '150', nat: 'Serbisch', marital: 'verheiratet', tax: 'IV', employed: 'Teilzeit', pschein: 90 },
]

const VEHICLES = [
  { plate: 'B-CD 1001', model: 'Mercedes-Benz E 220 d', color: 'Obsidianschwarz', fuel: 'Diesel', year: 2022, km: 84200, status: 'active', huOffset: 140, vin: 'WDD2130011A100101' },
  { plate: 'B-CD 1002', model: 'Toyota Prius+ Hybrid', color: 'Silber', fuel: 'Hybrid', year: 2021, km: 119800, status: 'active', huOffset: 30, vin: 'JTDZN3EU00J100202' },
  { plate: 'B-CD 1003', model: 'VW Caddy Maxi', color: 'Weiß', fuel: 'Diesel', year: 2020, km: 162400, status: 'maintenance', huOffset: -12, vin: 'WV2ZZZ2KZL1003003' },
  { plate: 'B-CD 1004', model: 'Tesla Model 3', color: 'Perlweiß', fuel: 'Elektro', year: 2023, km: 41200, status: 'active', huOffset: 380, vin: '5YJ3E7EA00F1004004' },
  { plate: 'B-CD 1005', model: 'Mercedes-Benz V 250 d', color: 'Tenoritgrau', fuel: 'Diesel', year: 2019, km: 205600, status: 'offline', huOffset: 55, vin: 'WDF44760300V100505' },
  { plate: 'B-CD 1006', model: 'Škoda Octavia Combi', color: 'Dunkelblau', fuel: 'Diesel', year: 2022, km: 97300, status: 'active', huOffset: 210, vin: 'TMBJJ7NE0N1006006' },
]

const veAvatar = (plate) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(plate.replace('B-CD ', ''))}&background=16a34a&color=fff&size=256&bold=true&length=4`

// ---- Hauptlauf --------------------------------------------------------
async function main() {
  console.log('\n=== TAS FLEET Demo-Seed: CityDrive Berlin GmbH ===\n')

  console.log('1) Alte Demo-Daten aufräumen')
  for (const k of ['owner', 'admin', 'member']) await purgeUser(CREDS[k].email)

  console.log('\n2) User & Profile anlegen')
  const ownerId = await createUser(CREDS.owner.email, CREDS.owner.password, CREDS.owner.first, CREDS.owner.last, CREDS.owner.avatar)
  const adminId = await createUser(CREDS.admin.email, CREDS.admin.password, CREDS.admin.first, CREDS.admin.last, CREDS.admin.avatar)
  const memberId = await createUser(CREDS.member.email, CREDS.member.password, CREDS.member.first, CREDS.member.last, CREDS.member.avatar)
  console.log(`  ✅ Owner ${ownerId}`)

  console.log('\n3) Firma anlegen (RPC create_company_with_owner)')
  const owner = await signedInClient(CREDS.owner.email, CREDS.owner.password)
  const { data: company, error: cErr } = await owner.rpc('create_company_with_owner', { company_name: 'CityDrive Berlin GmbH' })
  if (cErr) throw new Error(`RPC: ${cErr.message}`)
  const companyId = company.id
  console.log(`  ✅ ${company.name} (${companyId})`)

  // Logo + Team-Mitglieder
  ok('Firmenlogo', (await admin.from('companies').update({ logo_url: 'https://ui-avatars.com/api/?name=City+Drive&background=16a34a&color=fff&size=256&bold=true' }).eq('id', companyId)).error)
  ok('Betriebsleiter (admin) ins Team', (await admin.from('company_users').insert({ company_id: companyId, user_id: adminId, role: 'admin' })).error)
  ok('Disponent (member) ins Team', (await admin.from('company_users').insert({ company_id: companyId, user_id: memberId, role: 'member' })).error)

  // ---- Fahrer ---------------------------------------------------------
  console.log('\n4) Fahrer')
  const driverIds = DRIVERS.map(() => randomUUID())
  const driverRows = DRIVERS.map((d, i) => ({
    id: driverIds[i],
    company_id: companyId,
    name: `${d.first} ${d.last}`,
    first_name: d.first,
    last_name: d.last,
    street: d.street,
    street_number: d.nr,
    postal_code: d.postal,
    city: d.city,
    birth_date: day(-365 * (28 + i) - i * 30),
    nationality: d.nat,
    marital_status: d.marital,
    tax_class: d.tax,
    tax_id: `${10 + i}${('' + (12345678 + i * 137)).padStart(8, '0')}`,
    social_security_number: `${15 + i}${('' + (90 + i)).padStart(2, '0')}${('' + (100000 + i)).slice(-6)}B${i}`,
    health_insurance: ['AOK Nordost', 'Techniker Krankenkasse', 'Barmer', 'DAK-Gesundheit'][i % 4],
    employment_start_date: day(-365 - i * 90),
    employed_as: d.employed,
    bank_name: ['Berliner Sparkasse', 'Deutsche Bank', 'N26', 'Commerzbank'][i % 4],
    iban: `DE${('' + (10 + i)).slice(-2)} 1001 0010 ${('' + (1000000000 + i * 7)).slice(0, 4)} ${('' + (1000000000 + i * 7)).slice(4, 8)} ${('' + (10 + i)).slice(-2)}`,
    pschein_valid_until: day(d.pschein),
    district: d.district,
    current_shift: d.shift,
    notes: [],
    weekly_target_hours: d.employed === 'Teilzeit' ? 25 : 40,
    annual_vacation_days: d.employed === 'Teilzeit' ? 20 : 28,
    avatar_url: `https://i.pravatar.cc/300?img=${d.img}`,
  }))
  ok(`${driverRows.length} Fahrer`, (await owner.from('drivers').insert(driverRows)).error)

  // ---- Fahrzeuge ------------------------------------------------------
  console.log('\n5) Fahrzeuge')
  const vehicleIds = VEHICLES.map(() => randomUUID())
  const vehicleRows = VEHICLES.map((v, i) => ({
    id: vehicleIds[i],
    company_id: companyId,
    license_plate: v.plate,
    model: v.model,
    status: v.status,
    build_year: v.year,
    vin: v.vin,
    color: v.color,
    fuel_type: v.fuel,
    hu_due: day(v.huOffset),
    insurance_company: ['HUK-Coburg', 'Allianz', 'AXA', 'R+V'][i % 4],
    insurance_number: `VS-${2024}-${(1000 + i * 13)}`,
    insurance_due: day(120 + i * 20),
    purchase_date: day(-365 * (today.getFullYear() - v.year) - 40),
    mileage_km: v.km,
    avatar_url: veAvatar(v.plate),
  }))
  ok(`${vehicleRows.length} Fahrzeuge`, (await owner.from('vehicles').insert(vehicleRows)).error)

  // ---- Compliance-Dokumente ------------------------------------------
  console.log('\n6) Compliance-Dokumente')
  const compRows = []
  DRIVERS.forEach((d, i) => {
    const status = d.pschein < 0 ? 'expired' : d.pschein < 30 ? 'expiring' : 'valid'
    compRows.push({ company_id: companyId, scope_type: 'driver', driver_id: driverIds[i], doc_type: 'pschein', due_date: day(d.pschein), status, notes: 'Personenbeförderungsschein' })
  })
  VEHICLES.forEach((v, i) => {
    const huStatus = v.huOffset < 0 ? 'expired' : v.huOffset < 30 ? 'expiring' : 'valid'
    compRows.push({ company_id: companyId, scope_type: 'vehicle', vehicle_id: vehicleIds[i], doc_type: 'hu', due_date: day(v.huOffset), status: huStatus, notes: 'Hauptuntersuchung TÜV' })
    compRows.push({ company_id: companyId, scope_type: 'vehicle', vehicle_id: vehicleIds[i], doc_type: 'versicherung', due_date: day(120 + i * 20), status: 'valid', notes: 'Kfz-Haftpflicht + Vollkasko' })
  })
  // ein paar Uber-Freigaben
  ;[0, 3, 5].forEach((i) => compRows.push({ company_id: companyId, scope_type: 'vehicle', vehicle_id: vehicleIds[i], doc_type: 'uber_freigabe', due_date: day(75 + i * 10), status: 'valid', notes: 'Uber-Plattformfreigabe' }))
  ok(`${compRows.length} Dokumente`, (await owner.from('compliance_documents').insert(compRows)).error)

  // ---- Vorfälle -------------------------------------------------------
  console.log('\n7) Vorfälle')
  const incidents = [
    { incident_type: 'schaeden', d: 2, v: 2, occurred_on: day(-20), severity: 'medium', status: 'in_progress', description: 'Parkrempler hinten rechts, Stoßstange beschädigt. Werkstatttermin vereinbart.', cost_eur: 850.0 },
    { incident_type: 'bussgelder', d: 1, v: 0, occurred_on: day(-12), severity: 'low', status: 'open', description: 'Geschwindigkeitsüberschreitung 18 km/h innerorts (A 100).', cost_eur: 60.0 },
    { incident_type: 'schaeden', d: 5, v: 5, occurred_on: day(-45), severity: 'high', status: 'resolved', description: 'Auffahrunfall mit Sachschaden, Fahrzeug vorübergehend außer Betrieb.', cost_eur: 3200.0 },
    { incident_type: 'sperrungen', d: 4, v: 1, occurred_on: day(-7), severity: 'medium', status: 'open', description: 'Uber-Account temporär gesperrt nach Fahrgastbeschwerde – Klärung läuft.', cost_eur: 0.0 },
    { incident_type: 'bussgelder', d: 6, v: 4, occurred_on: day(-30), severity: 'low', status: 'resolved', description: 'Falschparken in Halteverbotszone, Verwarnungsgeld beglichen.', cost_eur: 55.0 },
    { incident_type: 'schaeden', d: 3, v: 3, occurred_on: day(-3), severity: 'medium', status: 'open', description: 'Steinschlag in der Frontscheibe, Reparatur durch Carglass geplant.', cost_eur: 140.0 },
  ].map((x) => ({
    company_id: companyId,
    incident_type: x.incident_type,
    driver_id: driverIds[x.d],
    vehicle_id: vehicleIds[x.v],
    occurred_on: x.occurred_on,
    severity: x.severity,
    status: x.status,
    description: x.description,
    cost_eur: x.cost_eur,
  }))
  ok(`${incidents.length} Vorfälle`, (await owner.from('incidents').insert(incidents)).error)

  // ---- Schichtplan (Disposition) -------------------------------------
  console.log('\n8) Schichtplan')
  const zones = ['Berlin Mitte', 'City West', 'Ost', 'Süd', 'Flughafen BER']
  const slots = ['Frueh', 'Spaet', 'Nacht']
  const shiftRows = []
  for (let dOff = 0; dOff < 5; dOff++) {
    slots.forEach((slot, si) => {
      const di = (dOff + si) % DRIVERS.length
      const vi = (dOff + si) % VEHICLES.length
      shiftRows.push({
        company_id: companyId,
        shift_date: day(dOff),
        shift_slot: slot,
        driver_id: driverIds[di],
        vehicle_id: vehicleIds[vi],
        uber_zone: zones[(dOff + si) % zones.length],
        notes: si === 2 ? 'Nachtzuschlag' : null,
      })
    })
  }
  ok(`${shiftRows.length} Schichtzuweisungen`, (await owner.from('shift_assignments').insert(shiftRows)).error)

  // ===== Folgende Tabellen stammen aus Migrationen 0014–0019. ==========
  // Falls noch nicht deployed -> wird sauber übersprungen.

  // ---- Abwesenheiten --------------------------------------------------
  console.log('\n9) Abwesenheiten')
  const absences = [
    { driver: 0, type: 'urlaub', start: 10, end: 24, reason: 'Sommerurlaub' },
    { driver: 2, type: 'krankheit', start: -4, end: 2, reason: 'Grippaler Infekt (AU liegt vor)' },
    { driver: 5, type: 'urlaub', start: 35, end: 49, reason: 'Familienurlaub' },
    { driver: 7, type: 'sonstiges', start: 5, end: 5, reason: 'Behördentermin' },
  ].map((a) => ({ company_id: companyId, driver_id: driverIds[a.driver], type: a.type, start_date: day(a.start), end_date: day(a.end), reason: a.reason }))
  ok(`${absences.length} Abwesenheiten`, (await owner.from('absences').insert(absences)).error)

  // ---- Fahrer-Notizen -------------------------------------------------
  console.log('\n10) Fahrer-Notizen')
  const notes = [
    { driver: 0, body: 'Sehr zuverlässig, übernimmt gerne Frühschichten. Top Kundenbewertungen.' },
    { driver: 1, body: 'P-Schein läuft in Kürze ab – Verlängerung anstoßen!' },
    { driver: 2, body: 'P-Schein abgelaufen. Darf bis zur Verlängerung NICHT eingesetzt werden.' },
    { driver: 4, body: 'Wunsch: bevorzugt Spätschicht wegen Studium.' },
    { driver: 6, body: '25 Jahre Betriebszugehörigkeit – Jubiläumsprämie vormerken.' },
  ].map((n) => ({
    company_id: companyId,
    driver_id: driverIds[n.driver],
    author_id: ownerId,
    author_name: `${CREDS.owner.first} ${CREDS.owner.last}`,
    body: n.body,
  }))
  ok(`${notes.length} Notizen`, (await owner.from('driver_notes').insert(notes)).error)

  // ---- Stundenzettel (als Disponent -> Audit-Vielfalt) ---------------
  console.log('\n11) Stundenzettel')
  let timesheetClient = owner
  let createdBy = ownerId
  try {
    timesheetClient = await signedInClient(CREDS.member.email, CREDS.member.password)
    createdBy = memberId
  } catch {
    /* Fallback: Owner */
  }
  const sheets = []
  for (const di of [0, 1, 4]) {
    for (let back = 1; back <= 12; back++) {
      const d = new Date(today)
      d.setDate(d.getDate() - back)
      const wd = d.getDay()
      if (wd === 0 || wd === 6) continue // keine Wochenenden
      const work = 7.5 + ((di + back) % 3)
      const ot = (back % 4 === 0) ? 1.5 : 0
      sheets.push({
        company_id: companyId,
        driver_id: driverIds[di],
        work_date: iso(d),
        start_time: '06:00',
        end_time: ot ? '15:30' : '14:00',
        pause: '00:30',
        work_hours: work.toFixed(1),
        overtime_hours: ot.toFixed(1),
        work_hours_num: work,
        overtime_num: ot,
        note: ot ? 'Überstunden Flughafenfahrt' : null,
        created_by: createdBy,
      })
    }
  }
  ok(`${sheets.length} Stundenzettel-Einträge`, (await timesheetClient.from('timesheet_entries').insert(sheets)).error)

  // ---- Fahrzeug-Wartung ----------------------------------------------
  console.log('\n12) Fahrzeug-Wartung & Kosten')
  const maint = []
  VEHICLES.forEach((v, i) => {
    maint.push({ company_id: companyId, vehicle_id: vehicleIds[i], service_date: day(-90 - i * 10), service_type: 'Inspektion', mileage_km: v.km - 5000, cost_eur: 320 + i * 25, note: 'Reguläre Wartung', next_due_date: day(180 - i * 10), next_due_km: v.km + 25000 })
    if (i % 2 === 0) maint.push({ company_id: companyId, vehicle_id: vehicleIds[i], service_date: day(-30 - i * 5), service_type: 'Reifenwechsel', mileage_km: v.km - 1500, cost_eur: 480, note: 'Sommerreifen montiert', next_due_date: null, next_due_km: null })
  })
  ok(`${maint.length} Wartungseinträge`, (await owner.from('vehicle_maintenance').insert(maint)).error)

  const costs = []
  VEHICLES.forEach((v, i) => {
    costs.push({ company_id: companyId, vehicle_id: vehicleIds[i], cost_date: day(-5 - i), category: 'Kraftstoff', amount_eur: 95.4 + i * 5, note: v.fuel === 'Elektro' ? 'Ladestrom' : 'Tankfüllung' })
    costs.push({ company_id: companyId, vehicle_id: vehicleIds[i], cost_date: day(-18 - i), category: 'Reparatur', amount_eur: 210 + i * 30, note: 'Bremsen geprüft' })
    costs.push({ company_id: companyId, vehicle_id: vehicleIds[i], cost_date: day(-2 - i), category: 'Reinigung', amount_eur: 24.9, note: 'Innen- & Außenreinigung' })
  })
  ok(`${costs.length} Kostenpositionen`, (await owner.from('vehicle_costs').insert(costs)).error)

  // ---- Abschluss ------------------------------------------------------
  console.log('\n=========================================================')
  console.log(' ✅ Demo-Account fertig')
  console.log('=========================================================')
  console.log(` Firma:     CityDrive Berlin GmbH`)
  console.log(` Login:     ${CREDS.owner.email}`)
  console.log(` Passwort:  ${CREDS.owner.password}`)
  console.log(` Team:      ${CREDS.admin.email} (Betriebsleiter), ${CREDS.member.email} (Disponent)`)
  console.log(`            Passwort identisch: ${CREDS.owner.password}`)
  console.log('=========================================================\n')
}

main().catch((e) => {
  console.error('\n❌ Abbruch:', e.message || e)
  process.exit(1)
})
