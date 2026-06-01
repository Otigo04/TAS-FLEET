import { requireUser } from '@/lib/auth'
import { DriversCrud } from '@/components/portal/drivers-crud'

export default async function FahrerPage() {
  const { supabase } = await requireUser()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fahrer</h1>
        <p className="mt-1 text-slate-600">Anlegen, bearbeiten und loeschen von Fahrerdaten.</p>
      </div>

      <DriversCrud initialDrivers={drivers ?? []} />
    </main>
  )
}
