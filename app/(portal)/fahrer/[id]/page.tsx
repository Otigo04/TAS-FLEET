import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { requireActiveCompany } from '@/lib/tenant'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/branding/user-avatar'
import { AttachmentList } from '@/components/portal/attachments'
import { DriverNotes } from '@/components/portal/driver-notes'
import { DriverNumberField } from '@/components/portal/driver-target-hours'
import { labelFor } from '@/lib/labels'

function field(value: string | null | undefined) {
  return value && value.trim() !== '' ? value : '—'
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, profile } = await requireUser()
  const company = await requireActiveCompany()

  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .maybeSingle()

  if (!driver) notFound()

  const [docsRes, absencesRes, shiftsRes, incidentsRes, vehiclesRes] = await Promise.all([
    supabase.from('compliance_documents').select('*').eq('driver_id', id).order('due_date', { ascending: true }),
    supabase.from('absences').select('*').eq('driver_id', id).order('start_date', { ascending: false }),
    supabase.from('shift_assignments').select('*').eq('driver_id', id).order('shift_date', { ascending: false }).limit(20),
    supabase.from('incidents').select('*').eq('driver_id', id).order('occurred_on', { ascending: false }),
    supabase.from('vehicles').select('id, license_plate').eq('company_id', company.id),
  ])

  const docs = docsRes.data ?? []
  const absences = absencesRes.data ?? []
  const shifts = shiftsRes.data ?? []
  const incidents = incidentsRes.data ?? []
  const plates = new Map((vehiclesRes.data ?? []).map((v) => [v.id, v.license_plate]))
  const authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email || 'Unbekannt'

  return (
    <main className="animate-fade-up space-y-5">
      <Link href="/fahrer" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Zurück zur Fahrerliste
      </Link>

      <div className="flex items-center gap-4">
        <UserAvatar avatarUrl={driver.avatar_url} name={driver.name} size="lg" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{driver.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {field(driver.district)} · Schicht: {field(driver.current_shift)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Stammdaten */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
            <CardDescription>Persönliche und dienstliche Angaben</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Detail label="Vorname" value={driver.first_name} />
              <Detail label="Nachname" value={driver.last_name} />
              <Detail label="Geburtsdatum" value={driver.birth_date} />
              <Detail label="Nationalität" value={driver.nationality} />
              <Detail label="Adresse" value={[driver.street, driver.street_number].filter(Boolean).join(' ')} />
              <Detail label="Ort" value={[driver.postal_code, driver.city].filter(Boolean).join(' ')} />
              <Detail label="P-Schein gültig bis" value={driver.pschein_valid_until} />
              <Detail label="Beschäftigt seit" value={driver.employment_start_date} />
              <Detail label="Steuerklasse" value={driver.tax_class} />
              <Detail label="IBAN" value={driver.iban} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <DriverNumberField driverId={driver.id} field="weekly_target_hours" label="Wochensoll (Std.)" initial={driver.weekly_target_hours} placeholder="z. B. 40" />
              <DriverNumberField driverId={driver.id} field="annual_vacation_days" label="Urlaub/Jahr (Tage)" initial={driver.annual_vacation_days} placeholder="z. B. 28" />
            </div>
          </CardContent>
        </Card>

        {/* Notizen */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Notizen</CardTitle>
            <CardDescription>Mit Autor und Zeitstempel</CardDescription>
          </CardHeader>
          <CardContent>
            <DriverNotes
              companyId={company.id}
              driverId={driver.id}
              userId={user.id}
              authorName={authorName}
              legacyNotes={driver.notes ?? []}
            />
          </CardContent>
        </Card>

        {/* Dokumente & Fristen */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Dokumente & Fristen</CardTitle>
            <CardDescription>Compliance und Dateien</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400">Keine Fristen hinterlegt.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700/60 text-sm">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-700 dark:text-slate-300">{labelFor(doc.doc_type)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{doc.due_date}</span>
                      <Badge variant="secondary">{labelFor(doc.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <AttachmentList companyId={company.id} scopeType="driver" entityId={driver.id} />
            </div>
          </CardContent>
        </Card>

        {/* Aktivität: Abwesenheiten, Schichten, Incidents */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Aktivität</CardTitle>
            <CardDescription>Abwesenheiten, Schichten, Vorfälle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Abwesenheiten</p>
              {absences.length === 0 ? (
                <p className="text-slate-400">Keine.</p>
              ) : (
                <ul className="space-y-1">
                  {absences.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{labelFor(a.type)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{a.start_date} – {a.end_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Letzte Schichten</p>
              {shifts.length === 0 ? (
                <p className="text-slate-400">Keine.</p>
              ) : (
                <ul className="space-y-1">
                  {shifts.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{s.shift_date} · {labelFor(s.shift_slot)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{plates.get(s.vehicle_id) ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Vorfälle</p>
              {incidents.length === 0 ? (
                <p className="text-slate-400">Keine.</p>
              ) : (
                <ul className="space-y-1">
                  {incidents.slice(0, 5).map((inc) => (
                    <li key={inc.id} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">{labelFor(inc.incident_type)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{inc.occurred_on}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-300">{value && value.trim() !== '' ? value : '—'}</dd>
    </div>
  )
}
