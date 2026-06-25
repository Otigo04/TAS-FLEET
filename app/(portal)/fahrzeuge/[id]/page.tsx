import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Car } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { getActiveContext } from '@/lib/tenant'
import { can } from '@/lib/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AttachmentList } from '@/components/portal/attachments'
import { VehicleDetail } from '@/components/portal/vehicle-detail'
import { labelFor } from '@/lib/labels'

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { company, isSuperadmin } = await getActiveContext()
  const canEdit = can(company.role, 'manageMasterData', isSuperadmin)

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .maybeSingle()

  if (!vehicle) notFound()

  const { data: incidents } = await supabase
    .from('incidents')
    .select('*')
    .eq('vehicle_id', id)
    .order('occurred_on', { ascending: false })

  return (
    <main className="animate-fade-up space-y-5">
      <Link href="/fahrzeuge" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Zurück zur Fahrzeugliste
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          {vehicle.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vehicle.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Car className="h-6 w-6 text-slate-400" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{vehicle.license_plate}</h1>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            {vehicle.model}
            <Badge variant={vehicle.status === 'active' ? 'success' : vehicle.status === 'maintenance' ? 'warning' : 'danger'}>
              {labelFor(vehicle.status)}
            </Badge>
          </p>
        </div>
      </div>

      <VehicleDetail vehicle={vehicle} companyId={company.id} canEdit={canEdit} incidents={incidents ?? []} />

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentList companyId={company.id} scopeType="vehicle" entityId={vehicle.id} canEdit={canEdit} />
        </CardContent>
      </Card>
    </main>
  )
}
