import { createClient } from '@/lib/supabase/server'
import { RealtimeBoard } from '@/app/dashboard/realtime-board'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [driversResult, vehiclesResult] = await Promise.all([
    supabase.from('drivers').select('*').order('created_at', { ascending: false }),
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
  ])

  const drivers = driversResult.data ?? []
  const vehicles = vehiclesResult.data ?? []

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-3 text-slate-600">
          Verbunden mit Supabase. Aktueller Benutzer:{' '}
          <span className="font-semibold text-slate-900">{user?.email ?? 'nicht eingeloggt'}</span>
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Fahrer: <span className="font-semibold text-slate-900">{drivers.length}</span> | Fahrzeuge:{' '}
          <span className="font-semibold text-slate-900">{vehicles.length}</span>
        </p>
      </div>

      <RealtimeBoard initialDrivers={drivers} initialVehicles={vehicles} />
    </main>
  )
}
