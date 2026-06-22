import { cn } from '@/lib/utils'

interface LoadingScreenProps {
  /** Render as a fixed full-viewport overlay (e.g. while switching company). */
  overlay?: boolean
  label?: string
  className?: string
}

/**
 * Clean, branded loading state. It stays invisible for the first 500ms
 * (`animate-delayed-appear`) so quick transitions never flash a spinner —
 * only genuinely slow loads (>0.5s) reveal it.
 */
export function LoadingScreen({ overlay = false, label = 'Wird geladen…', className }: LoadingScreenProps) {
  return (
    <div
      className={cn(
        'animate-delayed-appear flex flex-col items-center justify-center gap-5',
        overlay
          ? 'fixed inset-0 z-[200] bg-white/70 backdrop-blur-md'
          : 'min-h-[60vh] w-full',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative h-14 w-14">
        {/* Track */}
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
        {/* Spinning accent arc */}
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-emerald-500 border-r-teal-500" />
        {/* Soft pulsing core */}
        <div className="absolute inset-[5px] animate-pulse rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15" />
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">ORYON FLEET</p>
        <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}
