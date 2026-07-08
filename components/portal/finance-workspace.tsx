'use client'

import { useState } from 'react'
import { Landmark, Percent } from 'lucide-react'
import type { Database } from '@/lib/supabase/database.types'
import { FinanceManager } from '@/components/portal/finance-manager'
import { FuelRatioManager } from '@/components/portal/fuel-ratio-manager'
import { cn } from '@/lib/utils'

type FinanceRow = Database['public']['Tables']['finance_entries']['Row']
type SettingsRow = Database['public']['Tables']['settings']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type Tab = 'guv' | 'tank'

interface FinanceWorkspaceProps {
  initialEntries: FinanceRow[]
  initialSettings: SettingsRow[]
  initialVehicles: VehicleRow[]
}

export function FinanceWorkspace({
  initialEntries, initialSettings, initialVehicles,
}: FinanceWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('guv')

  const tabs: { key: Tab; label: string; icon: typeof Landmark }[] = [
    { key: 'guv', label: 'GuV / EÜR', icon: Landmark },
    { key: 'tank', label: 'Tank & Umsatz', icon: Percent },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              tab === key
                ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'guv' ? (
        <FinanceManager initialEntries={initialEntries} initialSettings={initialSettings} />
      ) : (
        <FuelRatioManager
          initialVehicles={initialVehicles}
          initialSettings={initialSettings}
        />
      )}
    </div>
  )
}
