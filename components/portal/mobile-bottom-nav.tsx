'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Car, CalendarDays, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

const primaryItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fahrer',    label: 'Fahrer',    icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
  { href: '/disposition', label: 'Disposition', icon: CalendarDays },
]

interface MobileBottomNavProps {
  onMoreClick: () => void
}

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Hauptnavigation"
      className="animate-slide-in-up fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16 items-stretch">
        {primaryItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '?')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
                isActive
                  ? 'text-emerald-600'
                  : 'text-slate-400 active:text-slate-600',
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-transform active:scale-90', isActive && 'text-emerald-600')}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              {item.label}
            </Link>
          )
        })}

        <button
          type="button"
          onClick={onMoreClick}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors active:text-slate-600"
          aria-label="Mehr Optionen"
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} />
          Mehr
        </button>
      </div>
    </nav>
  )
}
