'use client'

import { Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewMode, type ViewMode } from '@/components/portal/view-mode-provider'

const OPTIONS: { mode: ViewMode; label: string; icon: typeof Smartphone }[] = [
  { mode: 'mobile', label: 'Mobile Ansicht', icon: Smartphone },
  { mode: 'desktop', label: 'Desktop Ansicht', icon: Monitor },
]

/**
 * Cleaner segmentierter Schalter zum Umschalten zwischen Mobil- und
 * Desktop-Ansicht. Ein gleitender Pill markiert die aktive Wahl.
 */
export function ViewModeSlider() {
  const { mode, setMode } = useViewMode()
  // Vor dem ersten Effekt (mode === null) gilt das responsive Default-Layout –
  // optisch zeigen wir solange „Desktop", was sich beim Mount selbst korrigiert.
  const active: ViewMode = mode ?? 'desktop'

  return (
    <div
      role="group"
      aria-label="Ansichtsmodus"
      className="relative flex items-center rounded-full border border-slate-200 dark:border-slate-700/60 bg-slate-100/80 dark:bg-slate-800 p-0.5"
    >
      {/* Gleitender Hintergrund-Pill */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-9 rounded-full bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 transition-transform duration-300',
          active === 'desktop' ? 'translate-x-9' : 'translate-x-0',
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      />

      {OPTIONS.map(({ mode: value, label, icon: Icon }) => {
        const isActive = active === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
            className={cn(
              'relative z-10 flex h-8 w-9 items-center justify-center rounded-full transition-colors',
              isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 1.8} />
          </button>
        )
      })}
    </div>
  )
}
