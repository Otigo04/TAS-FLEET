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
          ? 'fixed inset-0 z-[200] bg-white/70 dark:bg-slate-900/90 backdrop-blur-md'
          : 'min-h-[60vh] w-full',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative h-12 w-12">
        {/* Track */}
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-700/60" />
        {/* Spinning accent arc */}
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-600" />
      </div>

      <div className="text-center">
        <p className="text-sm font-bold tracking-tight text-brand-700 dark:text-brand-300">TAS FLEET</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  )
}
