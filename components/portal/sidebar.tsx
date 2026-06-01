'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Car, Users, CalendarDays, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanyLogo } from '@/components/branding/company-logo'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schichtplanung', label: 'Schichtplanung', icon: CalendarDays },
  { href: '/fahrer', label: 'Fahrer', icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="surface-card w-72 border-b border-slate-200/70 p-4 lg:border-b-0 lg:border-r">
      <div className="mb-6 rounded-xl bg-gradient-to-br from-slate-900 to-teal-800 p-4 text-white">
        <CompanyLogo />
        <p className="mt-4 text-xs leading-relaxed text-slate-200">
          Realtime-Management fuer Fahrer und Flotte in einer klaren Admin-Oberflaeche.
        </p>
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
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'status-pulse bg-slate-900 text-white'
                  : 'text-slate-600 hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-900'
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
