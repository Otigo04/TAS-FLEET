'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Car, Users, CalendarDays, ShieldCheck, AlertTriangle, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanyLogo } from '@/components/branding/company-logo'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/disposition', label: 'Disposition', icon: CalendarDays },
  { href: '/schichtplanung', label: 'Schichtzettel', icon: CalendarDays },
  { href: '/fahrer', label: 'Fahrer', icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

interface SidebarProps {
  displayName?: string
}

export function Sidebar({ displayName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="surface-card w-72 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <CompanyLogo displayName={displayName} className="[&_*]:text-slate-900" />
      </div>

      <nav className="flex gap-2 lg:flex-col">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'status-pulse bg-emerald-50 text-emerald-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
