'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAnimatedDisclosure } from '@/components/portal/use-animated-disclosure'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const { state, isVisible, open, close } = useAnimatedDisclosure()
  const router = useRouter()

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
      {/* Desktop: inline search bar */}
      <form onSubmit={onSubmit} className="relative hidden md:flex w-full max-w-sm items-center">
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Schnellsuche (Fahrer, Fahrzeuge)..."
          className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-300 w-full"
        />
      </form>

      {/* Mobile: compact icon button that opens an overlay */}
      <button
        type="button"
        aria-label="Suche öffnen"
        onClick={open}
        className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Mobile: animated search sheet */}
      {isVisible && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            className="drawer-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            data-state={state}
            aria-label="Suche schließen"
            onClick={close}
          />

          <div className="absolute inset-x-0 top-0 px-3 pt-3">
            <form
              onSubmit={onSubmit}
              className="search-sheet w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              data-state={state}
            >
              <div className="flex items-center gap-3 p-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Fahrer, Fahrzeuge, …"
                  className="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={close}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100"
                  aria-label="Suche schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {query.trim() && (
                <button
                  type="submit"
                  className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
                >
                  Suche nach „{query.trim()}" →
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
