'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LayoutDashboard, Users, Car, CalendarDays, ShieldCheck, AlertTriangle, ShieldAlert, CalendarOff, FileText, History, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/branding/user-avatar'
import { cn } from '@/lib/utils'
import { useTenant } from '@/components/portal/tenant-provider'
import { can, roleLabel, type Capability } from '@/lib/roles'

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; cap?: Capability }

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
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

interface MobileSidebarProps {
  displayName?: string
  avatarUrl?: string | null
  isSuperadmin?: boolean
}

export function MobileSidebar({ displayName, avatarUrl, isSuperadmin }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { activeCompany } = useTenant()
  const visibleItems = items.filter(
    (item) => !item.cap || can(activeCompany.role, item.cap, isSuperadmin),
  )

  return (
    <>
      <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setIsOpen(true)}>
        <Menu className="h-4 w-4" />
        Menue
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/45" aria-label="Menue schliessen" onClick={() => setIsOpen(false)} />

          <aside className="animate-fade-up absolute left-0 top-0 h-full w-80 max-w-[90vw] border-r border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={avatarUrl} name={displayName} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">YOT FLEET</p>
                  {displayName ? <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p> : null}
                  <p className="text-xs text-slate-500">{isSuperadmin ? 'Superadmin' : roleLabel(activeCompany.role)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="space-y-2">
              {isSuperadmin && (
                <Link
                  href="/superadmin"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex w-full items-center gap-2 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Superadmin Konsole
                </Link>
              )}
              {visibleItems.map((item, index) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'animate-fade-up inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    )}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}
