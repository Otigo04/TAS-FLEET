'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Car, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fahrer', label: 'Fahrer', icon: Users },
  { href: '/fahrzeuge', label: 'Fahrzeuge', icon: Car },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-full border-b border-slate-200 bg-white p-4 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="mb-6 hidden lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">ON Mobility</p>
        <p className="mt-1 text-lg font-bold text-slate-900">Admin Portal</p>
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
                  ? 'bg-slate-900 text-white'
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
