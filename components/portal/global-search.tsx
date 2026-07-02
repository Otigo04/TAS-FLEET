'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAnimatedDisclosure } from '@/components/portal/use-animated-disclosure'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const { state, isVisible, open, close } = useAnimatedDisclosure()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
    close()
  }

  // Close the mobile overlay on Escape.
  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isVisible, close])

  return (
    <>
      {/* Header-Mittelspalte: füllt den freien Raum und richtet die Suche aus –
          Desktop-Leiste zentriert, mobiles Icon rechts neben den Aktionen. */}
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {/* Desktop: inline Schnellsuche (an echtem lg-Breakpoint UND erzwungenem
            Desktop-Modus; im Mobil-Modus ausgeblendet). */}
        <form
          onSubmit={onSubmit}
          className="vm-only-desktop vm-only-desktop-flex relative hidden lg:flex w-full max-w-sm items-center lg:mx-auto"
        >
          <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Schnellsuche (Fahrer, Fahrzeuge)..."
            className="pl-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 focus-visible:ring-slate-300 w-full"
          />
        </form>

        {/* Mobil: kompaktes Icon, das ein Overlay öffnet (spiegelt den Hamburger:
            lg:hidden + vm-only-mobile, damit es im Mobil-Modus immer erscheint). */}
        <button
          type="button"
          aria-label="Suche öffnen"
          onClick={open}
          className="vm-only-mobile vm-only-mobile-flex lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 active:bg-slate-100 dark:active:bg-slate-700"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile: animated search sheet. Per Portal an <body>, damit das fixe
          Overlay nicht im Header (transform = containing block) gefangen wird –
          sonst deckt der Backdrop nur die Header-Zeile ab und der Seiteninhalt
          liegt darüber. Kein Breakpoint-Guard nötig: öffnet nur über den
          mobilen Trigger. */}
      {mounted && isVisible &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <button
            className="drawer-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            data-state={state}
            aria-label="Suche schließen"
            onClick={close}
          />

          <div className="absolute inset-x-0 top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <form
              onSubmit={onSubmit}
              className="search-sheet w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-xl"
              data-state={state}
            >
              <div className="flex items-center gap-3 p-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Fahrer, Fahrzeuge, …"
                  className="min-w-0 flex-1 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={close}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Suche schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {query.trim() && (
                <button
                  type="submit"
                  className="block w-full border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-left text-sm font-medium text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-50"
                >
                  Suche nach „{query.trim()}" →
                </button>
              )}
            </form>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
