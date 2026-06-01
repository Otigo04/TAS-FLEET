import { requireUser } from '@/lib/auth'
import { DriversCrud } from '@/components/portal/drivers-crud'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FahrerPage() {
  const { supabase } = await requireUser()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false })

  const driverRows = drivers ?? []
  const expiringSoon = driverRows.filter((driver) => {
    const ms = new Date(driver.pschein_valid_until).getTime() - Date.now()
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  }).length
  const withNotes = driverRows.filter((driver) => (driver.notes ?? []).length > 0).length

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fahrer</h1>
        <p className="mt-1 text-slate-600">Anlegen, bearbeiten und loeschen von Fahrerdaten.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Fahrer insgesamt</CardTitle>
            <CardDescription>Aktive Datensaetze</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{driverRows.length}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>P-Schein Warnung</CardTitle>
            <CardDescription>Ablauf innerhalb 30 Tagen</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{expiringSoon}</p>
          </CardContent>
        </Card>
        <Card className="surface-card animate-fade-up-delay-3">
          <CardHeader>
            <CardTitle>Mit Notizpunkten</CardTitle>
            <CardDescription>Dokumentierte Sonderhinweise</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{withNotes}</p>
          </CardContent>
        </Card>
      </section>

      <DriversCrud initialDrivers={driverRows} />
    </main>
  )
}
