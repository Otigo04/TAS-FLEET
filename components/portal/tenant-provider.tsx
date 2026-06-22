'use client'

import { createContext, useContext } from 'react'
import type { UserCompany } from '@/lib/tenant'
import type { CompanyRole } from '@/lib/supabase/database.types'
import { can as canFor, type Capability } from '@/lib/roles'

type TenantContextValue = {
  activeCompany: UserCompany
  companies: UserCompany[]
  isSuperadmin: boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  activeCompany,
  companies,
  isSuperadmin = false,
  children,
}: {
  activeCompany: UserCompany
  companies: UserCompany[]
  isSuperadmin?: boolean
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={{ activeCompany, companies, isSuperadmin }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return ctx
}

/** Convenience hook: the id of the company the user is currently acting in. */
export function useActiveCompanyId(): string {
  return useTenant().activeCompany.id
}

/** Die Rolle des Nutzers in der aktiven Company. */
export function useActiveRole(): CompanyRole {
  return useTenant().activeCompany.role
}

/** Berechtigungs-Hook: prüft eine Capability für die aktive Rolle (inkl. Superadmin). */
export function useCan(capability: Capability): boolean {
  const { activeCompany, isSuperadmin } = useTenant()
  return canFor(activeCompany.role, capability, isSuperadmin)
}
