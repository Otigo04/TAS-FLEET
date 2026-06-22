'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type DisclosureState = 'closed' | 'open' | 'closing'

/**
 * Disclosure state machine with a real exit phase, so overlays can animate
 * out before they unmount. The component stays mounted during `closing` and
 * is removed once the exit animation duration has elapsed.
 *
 * While visible (`open` or `closing`) the body scroll is locked.
 *
 * @param durationMs must be >= the longest exit animation. A timer (not
 *   `animationend`) drives the unmount so it also works under
 *   `prefers-reduced-motion`, where animations are disabled.
 */
export function useAnimatedDisclosure(durationMs = 240) {
  const [state, setState] = useState<DisclosureState>('closed')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setState('open')
  }, [])

  const close = useCallback(() => {
    setState((s) => (s === 'open' ? 'closing' : s))
  }, [])

  // Drive the closing → closed transition.
  useEffect(() => {
    if (state !== 'closing') return
    timer.current = setTimeout(() => setState('closed'), durationMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state, durationMs])

  // Lock body scroll while the overlay is on screen.
  useEffect(() => {
    if (state === 'closed') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [state])

  return { state, isVisible: state !== 'closed', open, close }
}
