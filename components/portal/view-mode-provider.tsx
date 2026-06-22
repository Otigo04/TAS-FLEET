'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ViewMode = 'mobile' | 'desktop'

/** Breakpoint, ab dem ein Gerät als „Desktop" gilt (deckt sich mit Tailwinds `lg`). */
const DESKTOP_QUERY = '(min-width: 1024px)'

type ViewModeContextValue = {
  /** Aktiver Modus. `null` nur bis der erste Effekt nach dem Mount läuft. */
  mode: ViewMode | null
  setMode: (mode: ViewMode) => void
  toggle: () => void
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null)

/**
 * Hält den vom Nutzer wählbaren Ansichtsmodus (Mobil/Desktop) und spiegelt ihn
 * als `data-view-mode` auf <html>. Die Layout-CSS in globals.css erzwingt damit
 * das jeweilige Layout – unabhängig von der echten Viewport-Breite.
 *
 * Default ist immer das Gerät, auf dem man sich gerade befindet: solange der
 * Nutzer nicht selbst umschaltet, folgt der Modus der Viewport-Breite.
 */
export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode | null>(null)
  const userOverrode = useRef(false)

  // Geräte-Default setzen und – bis zum ersten manuellen Umschalten – folgen.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const sync = () => {
      if (!userOverrode.current) setModeState(mql.matches ? 'desktop' : 'mobile')
    }
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  // Aktiven Modus auf <html> spiegeln, damit die CSS-Overrides greifen.
  useEffect(() => {
    if (mode) document.documentElement.dataset.viewMode = mode
  }, [mode])

  const setMode = useCallback((next: ViewMode) => {
    userOverrode.current = true
    setModeState(next)
  }, [])

  const toggle = useCallback(() => {
    userOverrode.current = true
    setModeState((prev) => (prev === 'desktop' ? 'mobile' : 'desktop'))
  }, [])

  return (
    <ViewModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext)
  if (!ctx) throw new Error('useViewMode must be used within a ViewModeProvider')
  return ctx
}
