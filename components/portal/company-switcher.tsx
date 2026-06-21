'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { setActiveCompany } from '@/actions/tenant-actions'
import { useTenant } from '@/components/portal/tenant-provider'
import { LoadingScreen } from '@/components/portal/loading-screen'
import type { UserCompany } from '@/lib/tenant'
import { cn } from '@/lib/utils'

/** Square company logo (data URL) with an initials/icon fallback. */
function CompanyAvatar({ company, className }: { company: UserCompany; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md',
        className,
      )}
    >
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-1/2 w-1/2" />
      )}
    </span>
  )
}

export function CompanySwitcher() {
  const { activeCompany, companies } = useTenant()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => setMounted(true), [])

  // Position the portalled menu under the trigger, right-aligned. Recomputed
  // on open and kept in sync while the menu is open (scroll/resize).
  const reposition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Single-company users don't need a switcher — just show the name.
  if (companies.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700">
        <CompanyAvatar company={activeCompany} className="h-6 w-6 bg-slate-100 text-slate-400 ring-1 ring-slate-200" />
        <span className="max-w-[160px] truncate">{activeCompany.name}</span>
      </div>
    )
  }

  function handleSelect(companyId: string) {
    setOpen(false)
    if (companyId === activeCompany.id) return
    startTransition(async () => {
      const result = await setActiveCompany(companyId)
      if (result.success) router.refresh()
    })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-all disabled:opacity-60',
          open
            ? 'border-emerald-400 ring-2 ring-emerald-500/20'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <CompanyAvatar company={activeCompany} className="h-6 w-6 bg-slate-100 text-slate-400 ring-1 ring-slate-200" />
        <span className="max-w-[160px] truncate">{activeCompany.name}</span>
        <ChevronsUpDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'text-emerald-500')} />
      </button>

      {mounted && open && coords &&
        createPortal(
          <>
            {/* Click-away catcher — full viewport, above app chrome. */}
            <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)} aria-hidden="true" />

            <div
              role="menu"
              className="animate-dropdown-in fixed z-[130] w-72 overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl shadow-slate-950/40 ring-1 ring-black/5"
              style={{ top: coords.top, right: coords.right }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Unternehmen wechseln
                </p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  {companies.length}
                </span>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-1.5">
                {companies.map((company) => {
                  const isActive = company.id === activeCompany.id
                  return (
                    <button
                      key={company.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(company.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                        isActive ? 'bg-emerald-500/15' : 'hover:bg-white/5',
                      )}
                    >
                      <CompanyAvatar
                        company={company}
                        className={cn(
                          'h-9 w-9 ring-1',
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40'
                            : 'bg-white/5 text-slate-400 ring-white/10',
                        )}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className={cn('truncate text-sm font-semibold', isActive ? 'text-white' : 'text-slate-200')}>
                          {company.name}
                        </span>
                        <span className="text-xs capitalize text-slate-400">{company.role}</span>
                      </span>
                      {isActive && (
                        <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* Clean loading overlay while the tenant switch is in flight (>0.5s). */}
      {mounted && isPending &&
        createPortal(<LoadingScreen overlay label="Unternehmen wird gewechselt…" />, document.body)}
    </>
  )
}
