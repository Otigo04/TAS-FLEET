'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { setActiveCompany } from '@/actions/tenant-actions'
import { useTenant } from '@/components/portal/tenant-provider'

export function CompanySwitcher() {
  const { activeCompany, companies } = useTenant()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Single-company users don't need a switcher — just show the name.
  if (companies.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
        <Building2 className="h-4 w-4 text-slate-400" />
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="max-w-[160px] truncate">{activeCompany.name}</span>
        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unternehmen wechseln
            </p>
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => handleSelect(company.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{company.name}</span>
                  <span className="text-xs capitalize text-slate-400">{company.role}</span>
                </span>
                {company.id === activeCompany.id && <Check className="h-4 w-4 shrink-0 text-slate-900" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
