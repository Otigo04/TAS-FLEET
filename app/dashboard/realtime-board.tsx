'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']

interface RealtimeBoardProps {
  initialDrivers: DriverRow[]
  initialVehicles: VehicleRow[]
}

export function RealtimeBoard({ initialDrivers, initialVehicles }: RealtimeBoardProps) {
  const [drivers, setDrivers] = useState<DriverRow[]>(initialDrivers)
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function refreshAll() {
      setIsRefreshing(true)

      const [driversResult, vehiclesResult] = await Promise.all([
        supabase
          .from('drivers')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (!isMounted) {
        return
      }

      if (driversResult.data) {
        setDrivers(driversResult.data)
      }

      if (vehiclesResult.data) {
        setVehicles(vehiclesResult.data)
      }

      setIsRefreshing(false)
    }

    const channel = supabase
      .channel('fleet-and-drivers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          void refreshAll()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => {
          void refreshAll()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fahrer</h2>
          <span className="text-xs text-slate-500">{isRefreshing ? 'syncing...' : 'live'}</span>
        </div>
        <ul className="mt-4 space-y-3">
          {drivers.length === 0 ? (
            <li className="text-sm text-slate-500">Noch keine Fahrer erfasst.</li>
          ) : (
            drivers.map((driver) => (
              <li key={driver.id} className="rounded-lg border border-slate-100 p-3">
                <p className="font-medium">{driver.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Bezirk: {driver.district} | Schicht: {driver.current_shift}
                </p>
                <p className="text-xs text-slate-500">
                  P-Schein gueltig bis: {driver.pschein_valid_until}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fahrzeuge</h2>
          <span className="text-xs text-slate-500">{isRefreshing ? 'syncing...' : 'live'}</span>
        </div>
        <ul className="mt-4 space-y-3">
          {vehicles.length === 0 ? (
            <li className="text-sm text-slate-500">Noch keine Fahrzeuge erfasst.</li>
          ) : (
            vehicles.map((vehicle) => (
              <li key={vehicle.id} className="rounded-lg border border-slate-100 p-3">
                <p className="font-medium">{vehicle.license_plate}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Modell: {vehicle.model} | Status: {vehicle.status}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}
