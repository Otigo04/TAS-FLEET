'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Desktop search bar */}
      <form onSubmit={onSubmit} className="relative hidden md:flex w-full max-w-sm items-center">
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Schnellsuche (Fahrer, Fahrzeuge)..."
          className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-300 w-full"
        />
      </form>

      {/* Mobile: compact icon button + expandable bar */}
      <button
        type="button"
        aria-label="Suche öffnen"
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Mobile search overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/30 backdrop-blur-sm flex items-start pt-16 px-4">
          <form
            onSubmit={onSubmit}
            className="animate-scale-in w-full rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Fahrer, Fahrzeuge, ..."
                className="flex-1 text-base text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => { setMobileOpen(false); setQuery('') }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {query.trim() && (
              <div className="border-t border-slate-100 px-4 py-3">
                <button type="submit" className="w-full text-left text-sm text-emerald-600 font-medium">
                  Suche nach „{query.trim()}" →
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  )
}
