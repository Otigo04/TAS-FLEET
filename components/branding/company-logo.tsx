import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  compact?: boolean
  className?: string
  displayName?: string
}

export function CompanyLogo({ compact = false, className, displayName }: CompanyLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div className="relative h-11 w-11 overflow-hidden rounded-md border border-slate-200 bg-white shadow-md ring-1 ring-white/60">
        <Image
          src="/ON-MOBILITY_LOGO_300x300.png"
          alt="ON Mobility Logo"
          fill
          sizes="44px"
          className="object-contain"
          priority
        />
      </div>

      {!compact ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">ORYON FLEET</p>
          {displayName ? <p className="text-sm font-semibold text-slate-100">{displayName}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
