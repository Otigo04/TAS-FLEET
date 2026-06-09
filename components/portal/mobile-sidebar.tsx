'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LayoutDashboard, Users, Car, CalendarDays, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompanyLogo } from '@/components/branding/company-logo'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schichtplanung', label: 'Schichtplanung', icon: CalendarDays },
  { href: '/fahrer', label: 'Fahrer', icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
]

interface MobileSidebarProps {
  displayName?: string
}

export function MobileSidebar({ displayName }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

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
              <CompanyLogo compact={false} className="[&_*]:text-slate-900" displayName={displayName} />
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="space-y-2">
              {items.map((item, index) => {
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
