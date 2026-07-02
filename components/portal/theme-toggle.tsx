'use client'

import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tas-fleet-theme'

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Hell/Dunkel-Umschalter. Der initiale Zustand kommt aus dem Inline-Script im
 * Root-Layout (kein Flash beim Laden); hier wird nur noch umgeschaltet und
 * die Wahl in localStorage gemerkt.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Erst nach dem Mount rendern wir den echten Zustand (SSR kennt das Theme nicht).
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setMounted(true)
    setTheme(readTheme())
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    // Farbwechsel weich animieren, Klasse danach wieder entfernen.
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
    root.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* Private-Mode o. ä. — Theme gilt dann nur für diese Sitzung. */
    }
    setTheme(next)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
      title={isDark ? 'Helles Design' : 'Dunkles Design'}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700',
        'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white',
        className,
      )}
    >
      {/* Beide Icons übereinander, weich überblendet & gedreht. */}
      <Sun
        className={cn(
          'absolute h-4 w-4 transition-all duration-300',
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
      />
      <Moon
        className={cn(
          'absolute h-4 w-4 transition-all duration-300',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
        )}
      />
    </button>
  )
}
