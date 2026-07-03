'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  /** Text im Button, solange nichts (Sinnvolles) gewählt ist. */
  placeholder?: string
  /** Text im leeren Suchergebnis. */
  emptyMessage?: string
  id?: string
  disabled?: boolean
  className?: string
}

/**
 * Zugängliche Combobox mit Freitext-Filter — als Ersatz für lange native
 * <select>-Dropdowns (z. B. Fahrer-/Fahrzeugauswahl bei 100+ Einträgen).
 * Der ausgewählte Wert bleibt ein einfacher String, damit die Ansteuerung
 * identisch zum bisherigen <select value onChange> bleibt.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Auswählen …',
  emptyMessage = 'Kein Treffer.',
  id,
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  // Schließen bei Klick außerhalb.
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Beim Öffnen Fokus in das Suchfeld und Filter zurücksetzen.
  React.useEffect(() => {
    if (open) {
      setQuery('')
      const raf = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-left text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selected && 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtered.length > 0) choose(filtered[0]!.value)
                }
              }}
              placeholder="Suchen …"
              className="h-10 w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</li>
            ) : (
              filtered.map((option) => {
                const active = option.value === value
                return (
                  <li key={option.value || '__empty__'} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => choose(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                        active && 'bg-slate-50 dark:bg-slate-800/60 font-medium',
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
