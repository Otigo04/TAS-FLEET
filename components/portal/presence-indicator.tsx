'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/branding/user-avatar'
import { useActiveCompanyId } from '@/components/portal/tenant-provider'

interface PresenceIndicatorProps {
  userId: string
  displayName: string
  avatarUrl: string | null
}

type PresenceMeta = {
  name: string
  avatarUrl: string | null
  path: string
}

type OnlineUser = PresenceMeta & { key: string }

const SECTION_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/disposition': 'Disposition',
  '/schichtplanung': 'Schichtzettel',
  '/abwesenheiten': 'Abwesenheiten',
  '/fahrer': 'Fahrer',
  '/fahrzeuge': 'Fahrzeuge',
  '/compliance': 'Compliance',
  '/incidents': 'Incidents',
  '/berichte': 'Berichte',
  '/verlauf': 'Verlauf',
  '/einstellungen': 'Einstellungen',
  '/search': 'Suche',
}

function sectionLabel(path: string): string {
  return SECTION_LABELS[path] ?? 'dem Portal'
}

export function PresenceIndicator({ userId, displayName, avatarUrl }: PresenceIndicatorProps) {
  const supabase = useMemo(() => createClient(), [])
  const companyId = useActiveCompanyId()
  const pathname = usePathname()

  const [online, setOnline] = useState<OnlineUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  useEffect(() => {
    const channel = supabase.channel(`presence-company-${companyId}`, {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>
      const others: OnlineUser[] = Object.entries(state)
        .filter(([key]) => key !== userId)
        .map(([key, metas]) => ({ key, ...metas[0] }))
      setOnline(others)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ name: displayName, avatarUrl, path: pathRef.current })
      }
    })

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [supabase, companyId, userId, displayName, avatarUrl])

  // Beim Seitenwechsel die eigene Präsenz aktualisieren.
  useEffect(() => {
    void channelRef.current?.track({ name: displayName, avatarUrl, path: pathname })
  }, [pathname, displayName, avatarUrl])

  if (online.length === 0) return null

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 flex max-w-[80vw] flex-col items-end gap-2">
      {online.map((u) => (
        <div
          key={u.key}
          title={`${u.name} bearbeitet gerade ${sectionLabel(u.path)}`}
          className="animate-fade-up flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur"
        >
          <span className="relative inline-flex shrink-0">
            <UserAvatar avatarUrl={u.avatarUrl} name={u.name} size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </span>
          <span className="text-xs leading-tight">
            <span className="font-semibold text-slate-900">{u.name}</span>
            <span className="block text-[11px] text-slate-500">bearbeitet {sectionLabel(u.path)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
