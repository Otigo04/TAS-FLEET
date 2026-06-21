'use client'

import { createContext, useContext } from 'react'
import type { UserCompany } from '@/lib/tenant'

type TenantContextValue = {
  activeCompany: UserCompany
  companies: UserCompany[]
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  activeCompany,
  companies,
  children,
}: {
  activeCompany: UserCompany
  companies: UserCompany[]
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={{ activeCompany, companies }}>
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
