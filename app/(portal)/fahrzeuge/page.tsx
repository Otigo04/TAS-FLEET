import { requireUser } from '@/lib/auth'
import { VehiclesCrud } from '@/components/portal/vehicles-crud'

export default async function FahrzeugePage() {
  const { supabase } = await requireUser()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fahrzeuge</h1>
        <p className="mt-1 text-slate-600">Anlegen, bearbeiten und loeschen von Flottendaten.</p>
      </div>

      <VehiclesCrud initialVehicles={vehicles ?? []} />
    </main>
  )
}
