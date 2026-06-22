'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, Car, Users, CalendarDays, ShieldCheck, AlertTriangle, Settings, ChevronRight, ShieldAlert, CalendarOff, FileText, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/branding/user-avatar'
import { Suspense } from 'react'
import { useTenant } from '@/components/portal/tenant-provider'
import { can, roleLabel, type Capability } from '@/lib/roles'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  cap?: Capability
  subItems?: { tab: string; label: string; cap?: Capability }[]
}

const items: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/disposition', label: 'Disposition', icon: CalendarDays, cap: 'manageDispatch' },
  { href: '/schichtplanung', label: 'Schichtzettel', icon: CalendarDays },
  { href: '/abwesenheiten', label: 'Abwesenheiten', icon: CalendarOff, cap: 'manageAbsences' },
  { href: '/fahrer', label: 'Fahrer', icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle, cap: 'manageIncidents' },
  { href: '/berichte', label: 'Berichte', icon: FileText, cap: 'viewReports' },
  { href: '/verlauf', label: 'Verlauf', icon: History, cap: 'viewAudit' },
  {
    href: '/einstellungen',
    label: 'Einstellungen',
    icon: Settings,
    subItems: [
      { tab: 'account', label: 'Account' },
      { tab: 'werte', label: 'Werte & Status', cap: 'manageSettings' },
    ],
  },
]

interface SidebarProps {
  displayName?: string
  avatarUrl?: string | null
  isSuperadmin?: boolean
}

function SidebarBrand({ displayName, avatarUrl }: { displayName?: string; avatarUrl?: string | null }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <UserAvatar avatarUrl={avatarUrl} name={displayName} size="lg" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">ORYON FLEET</p>
        {displayName ? <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p> : null}
      </div>
    </div>
  )
}

function SidebarNav({ displayName, avatarUrl, isSuperadmin }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'account'
  const { activeCompany } = useTenant()

  const visibleItems = items.filter(
    (item) => !item.cap || can(activeCompany.role, item.cap, isSuperadmin),
  )

  return (
    <aside className="surface-card w-72 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
      <SidebarBrand displayName={displayName} avatarUrl={avatarUrl} />

      <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Rolle</span>
        <span className="text-xs font-semibold text-slate-700">
          {isSuperadmin ? 'Superadmin' : roleLabel(activeCompany.role)}
        </span>
      </div>

      {isSuperadmin && (
        <Link
          href="/superadmin"
          className="mb-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm transition-transform hover:scale-[1.02]"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Superadmin Konsole
        </Link>
      )}

      <nav className="flex gap-1 lg:flex-col">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          const visibleSubItems = (item.subItems ?? []).filter(
            (sub) => !sub.cap || can(activeCompany.role, sub.cap, isSuperadmin),
          )
          const hasSubItems = visibleSubItems.length > 0

          return (
            <div key={item.href} className="w-full">
              <Link
                href={item.href}
                className={cn(
                  'inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
                {hasSubItems && (
                  <ChevronRight
                    className={cn(
                      'ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-in-out',
                      isActive && 'rotate-90',
                    )}
                  />
                )}
              </Link>

              {/* Animated sub-items */}
              {hasSubItems && (
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    isActive ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
                  )}
                >
                  <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l-2 border-slate-200 pl-3 pb-1">
                    {visibleSubItems.map((sub, i) => (
                      <Link
                        key={sub.tab}
                        href={`/einstellungen?tab=${sub.tab}`}
                        className={cn(
                          'block rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                          isActive
                            ? 'translate-x-0 opacity-100'
                            : '-translate-x-1 opacity-0',
                          activeTab === sub.tab
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                        )}
                        style={{ transitionDelay: isActive ? `${i * 55 + 70}ms` : '0ms' }}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export function Sidebar({ displayName, avatarUrl, isSuperadmin }: SidebarProps) {
  return (
    <Suspense
      fallback={
        <aside className="surface-card w-72 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <SidebarBrand displayName={displayName} avatarUrl={avatarUrl} />
        </aside>
      }
    >
      <SidebarNav displayName={displayName} avatarUrl={avatarUrl} isSuperadmin={isSuperadmin} />
    </Suspense>
  )
}
