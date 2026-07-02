'use client'

import { createContext, useContext, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, Users, Car, CalendarDays, ShieldCheck,
  AlertTriangle, ShieldAlert, CalendarOff, FileText, History, Settings, Euro,
} from 'lucide-react'
import { UserAvatar } from '@/components/branding/user-avatar'
import { cn } from '@/lib/utils'
import { useTenant } from '@/components/portal/tenant-provider'
import { can, roleLabel, type Capability } from '@/lib/roles'
import { useAnimatedDisclosure } from '@/components/portal/use-animated-disclosure'

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; cap?: Capability }

const items: NavItem[] = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/disposition',    label: 'Disposition',   icon: CalendarDays,  cap: 'manageDispatch' },
  { href: '/schichtplanung', label: 'Schichtzettel', icon: CalendarDays },
  { href: '/abwesenheiten',  label: 'Abwesenheiten', icon: CalendarOff,   cap: 'manageAbsences' },
  { href: '/fahrer',         label: 'Fahrer',        icon: Users },
  { href: '/fahrzeuge',      label: 'Fahrzeuge',     icon: Car },
  { href: '/compliance',     label: 'Compliance',    icon: ShieldCheck },
  { href: '/incidents',      label: 'Incidents',     icon: AlertTriangle, cap: 'manageIncidents' },
  { href: '/berichte',       label: 'Berichte',      icon: FileText,      cap: 'viewReports' },
  { href: '/finanzen',       label: 'Finanzen',      icon: Euro,          cap: 'viewReports' },
  { href: '/verlauf',        label: 'Verlauf',       icon: History,       cap: 'viewAudit' },
  { href: '/einstellungen',  label: 'Einstellungen', icon: Settings },
]

interface NavUser {
  displayName?: string
  avatarUrl?: string | null
  isSuperadmin?: boolean
}

const MobileNavContext = createContext<{ open: () => void } | null>(null)

/** Opens the shared mobile navigation drawer (hamburger + bottom-nav "Mehr"). */
export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within a MobileNavProvider')
  return ctx
}

/**
 * Holds the single drawer instance used by both the top-bar hamburger and the
 * bottom-nav "Mehr" button, so there is one source of truth and one animated
 * panel instead of two duplicated ones.
 */
export function MobileNavProvider({ children, ...user }: NavUser & { children: React.ReactNode }) {
  const { state, isVisible, open, close } = useAnimatedDisclosure()
  const pathname = usePathname()

  // Close on navigation and on Escape.
  useEffect(() => { close() }, [pathname, close])
  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isVisible, close])

  return (
    <MobileNavContext.Provider value={{ open }}>
      {children}
      {isVisible && <MobileNavDrawer state={state} onClose={close} {...user} />}
    </MobileNavContext.Provider>
  )
}

/** Hamburger button for the top bar. */
export function MobileNavTrigger() {
  const { open } = useMobileNav()
  return (
    <button
      type="button"
      aria-label="Navigation öffnen"
      onClick={open}
      className="vm-only-mobile vm-only-mobile-flex lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 active:bg-slate-100 dark:active:bg-slate-700"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}

function MobileNavDrawer({
  state,
  onClose,
  displayName,
  avatarUrl,
  isSuperadmin,
}: NavUser & { state: 'open' | 'closing' | 'closed'; onClose: () => void }) {
  const pathname = usePathname()
  const { activeCompany } = useTenant()
  const visibleItems = items.filter(
    (item) => !item.cap || can(activeCompany.role, item.cap, isSuperadmin),
  )

  return (
    <div className="vm-only-mobile-block fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        className="drawer-backdrop absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        data-state={state}
        aria-label="Navigation schließen"
        onClick={onClose}
      />

      <aside
        className="drawer-panel absolute inset-y-0 left-0 flex h-full w-80 max-w-[90vw] flex-col bg-white dark:bg-slate-900 shadow-2xl"
        data-state={state}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <UserAvatar avatarUrl={avatarUrl} name={displayName} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-brand-700 dark:text-brand-300">TAS FLEET</p>
              {displayName ? <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p> : null}
              <p className="text-xs text-slate-500 dark:text-slate-400">{isSuperadmin ? 'Superadmin' : roleLabel(activeCompany.role)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70"
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {isSuperadmin && (
            <Link
              href="/superadmin"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2"
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
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-600',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 1.8} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mobile-safe-bottom" />
      </aside>
    </div>
  )
}
