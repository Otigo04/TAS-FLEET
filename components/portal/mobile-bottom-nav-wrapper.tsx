'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  X, LayoutDashboard, Users, Car, CalendarDays, ShieldCheck,
  AlertTriangle, Settings, ShieldAlert, CalendarOff, FileText,
  History, Menu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/branding/user-avatar'
import { MobileBottomNav } from '@/components/portal/mobile-bottom-nav'
import { useTenant } from '@/components/portal/tenant-provider'
import { can, roleLabel, type Capability } from '@/lib/roles'

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; cap?: Capability }

const allItems: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/disposition',  label: 'Disposition',   icon: CalendarDays,  cap: 'manageDispatch' },
  { href: '/schichtplanung', label: 'Schichtzettel', icon: CalendarDays },
  { href: '/abwesenheiten', label: 'Abwesenheiten', icon: CalendarOff,  cap: 'manageAbsences' },
  { href: '/fahrer',       label: 'Fahrer',         icon: Users },
  { href: '/fahrzeuge',    label: 'Fahrzeuge',      icon: Car },
  { href: '/compliance',   label: 'Compliance',     icon: ShieldCheck },
  { href: '/incidents',    label: 'Incidents',      icon: AlertTriangle, cap: 'manageIncidents' },
  { href: '/berichte',     label: 'Berichte',       icon: FileText,      cap: 'viewReports' },
  { href: '/verlauf',      label: 'Verlauf',        icon: History,       cap: 'viewAudit' },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

interface Props {
  displayName?: string
  avatarUrl?: string | null
  isSuperadmin?: boolean
}

export function MobileBottomNavWrapper({ displayName, avatarUrl, isSuperadmin }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const { activeCompany } = useTenant()

  const visibleItems = allItems.filter(
    (item) => !item.cap || can(activeCompany.role, item.cap, isSuperadmin),
  )

  return (
    <>
      <MobileBottomNav onMoreClick={() => setDrawerOpen(true)} />

      {/* Full-screen "Mehr" drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Schließen"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 w-80 max-w-[90vw] bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="md" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">YOT FLEET</p>
                  {displayName ? (
                    <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {isSuperadmin ? 'Superadmin' : roleLabel(activeCompany.role)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {isSuperadmin && (
                <Link
                  href="/superadmin"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 mb-2"
                >
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  Superadmin Konsole
                </Link>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Footer safe area spacer */}
            <div className="mobile-safe-bottom" />
          </aside>
        </div>
      )}
    </>
  )
}
