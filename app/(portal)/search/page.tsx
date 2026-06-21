import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface SearchPageProps {
  searchParams: { q?: string }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { supabase } = await requireUser()
  const query = searchParams.q ?? ''
  
  if (!query.trim()) {
    return (
      <main className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Suchergebnisse</h1>
        <p className="text-slate-600">Bitte gib einen Suchbegriff ein.</p>
      </main>
    )
  }

  // Very basic full text or simple ILIKE search
  const [driversResult, vehiclesResult] = await Promise.all([
    supabase.from('drivers').select('*').or(`name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`),
    supabase.from('vehicles').select('*').or(`license_plate.ilike.%${query}%,model.ilike.%${query}%`)
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Suchergebnisse</h1>
        <p className="mt-1 text-slate-600">Ergebnisse für: <span className="font-semibold">&quot;{query}&quot;</span></p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="surface-card animate-fade-up-delay">
          <CardHeader>
            <CardTitle>Fahrer ({drivers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Fahrer gefunden.</p>
            ) : (
              <ul className="space-y-3">
                {drivers.map(driver => (
                  <li key={driver.id} className="rounded-lg border border-slate-200 bg-white p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-900">{driver.name}</p>
                      <p className="text-xs text-slate-500">{driver.district || 'Kein Bezirk'}</p>
                    </div>
                    <Link href={`/fahrer`} className="text-sm text-sky-600 hover:underline">Zum Fahrer</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card animate-fade-up-delay-2">
          <CardHeader>
            <CardTitle>Fahrzeuge ({vehicles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Fahrzeuge gefunden.</p>
            ) : (
              <ul className="space-y-3">
                {vehicles.map(vehicle => (
                  <li key={vehicle.id} className="rounded-lg border border-slate-200 bg-white p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{vehicle.license_plate}</p>
                        <Badge variant="secondary" className="text-xs">{vehicle.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{vehicle.model}</p>
                    </div>
                    <Link href={`/fahrzeuge`} className="text-sm text-sky-600 hover:underline">Zum Fahrzeug</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
