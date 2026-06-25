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
      <div className="relative h-11 w-11 overflow-hidden rounded-md border border-slate-200 bg-white">
        <Image
          src="/ON-MOBILITY_LOGO_300x300.png"
          alt="TAS FLEET Logo"
          fill
          sizes="44px"
          className="object-contain"
          priority
        />
      </div>

      {!compact ? (
        <div>
          <p className="text-sm font-bold tracking-tight text-brand-700">TAS FLEET</p>
          {displayName ? <p className="text-sm font-semibold text-slate-900">{displayName}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
