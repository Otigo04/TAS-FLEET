'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'
import { labelFor } from '@/lib/labels'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  userId: string
}

interface DeadlineItem {
  key: string
  title: string
  days: number
}

const THRESHOLD_DAYS = 30

function daysUntil(dateString: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DeadlineItem[]>([])
  const [reads, setReads] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!companyId) return
    const [driversRes, docsRes, vehiclesRes, readsRes] = await Promise.all([
      supabase.from('drivers').select('id, name, pschein_valid_until').eq('company_id', companyId),
      supabase
        .from('compliance_documents')
        .select('id, scope_type, driver_id, vehicle_id, doc_type, due_date')
        .eq('company_id', companyId),
      supabase.from('vehicles').select('id, license_plate').eq('company_id', companyId),
      supabase.from('notification_reads').select('item_key').eq('company_id', companyId).eq('user_id', userId),
    ])

    const drivers = driversRes.data ?? []
    const docs = docsRes.data ?? []
    const vehicles = vehiclesRes.data ?? []
    const driverName = new Map(drivers.map((d) => [d.id, d.name]))
    const vehiclePlate = new Map(vehicles.map((v) => [v.id, v.license_plate]))

    const next: DeadlineItem[] = []

    for (const driver of drivers) {
      if (!driver.pschein_valid_until) continue
      const days = daysUntil(driver.pschein_valid_until)
      if (days <= THRESHOLD_DAYS) {
        next.push({
          key: `pschein:${driver.id}:${driver.pschein_valid_until}`,
          title: `P-Schein: ${driver.name}`,
          days,
        })
      }
    }

    for (const doc of docs) {
      if (!doc.due_date) continue
      const days = daysUntil(doc.due_date)
      if (days > THRESHOLD_DAYS) continue
      const subject =
        doc.scope_type === 'driver'
          ? driverName.get(doc.driver_id ?? '') ?? 'Fahrer'
          : vehiclePlate.get(doc.vehicle_id ?? '') ?? 'Fahrzeug'
      next.push({
        key: `compliance:${doc.id}:${doc.due_date}`,
        title: `${labelFor(doc.doc_type)}: ${subject}`,
        days,
      })
    }

    next.sort((a, b) => a.days - b.days)
    setItems(next)
    setReads(new Set((readsRes.data ?? []).map((r) => r.item_key)))
  }, [supabase, companyId, userId])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime: Fristen oder Lese-Status ändern sich -> neu berechnen.
  useEffect(() => {
    if (!companyId) return
    const channel = supabase
      .channel(`notifications-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compliance_documents', filter: `company_id=eq.${companyId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `company_id=eq.${companyId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_reads', filter: `company_id=eq.${companyId}` }, () => void load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, companyId, load])

  const unread = items.filter((item) => !reads.has(item.key))
  const unreadCount = unread.length

  async function markRead(keys: string[]) {
    if (!companyId || keys.length === 0) return
    setReads((prev) => {
      const next = new Set(prev)
      keys.forEach((k) => next.add(k))
      return next
    })
    await supabase.from('notification_reads').upsert(
      keys.map((item_key) => ({ user_id: userId, company_id: companyId, item_key })),
      { onConflict: 'user_id,company_id,item_key' },
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Benachrichtigungen"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="animate-dropdown-in absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-800">Ablaufende Fristen</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markRead(unread.map((i) => i.key))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Alle gelesen
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Keine Fristen in den nächsten {THRESHOLD_DAYS} Tagen.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {items.map((item) => {
                  const isRead = reads.has(item.key)
                  return (
                    <li
                      key={item.key}
                      className={cn('flex items-center justify-between gap-2 px-4 py-2.5', !isRead && 'bg-brand-50/40')}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{item.title}</p>
                        <p className="text-xs text-slate-400">
                          {item.days < 0 ? `${Math.abs(item.days)} Tage überfällig` : `in ${item.days} Tagen`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={item.days < 0 ? 'danger' : item.days <= 7 ? 'warning' : 'secondary'}>
                          {item.days < 0 ? 'fällig' : `${item.days}T`}
                        </Badge>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => void markRead([item.key])}
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Als gelesen markieren"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
