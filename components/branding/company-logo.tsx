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
      <div className="relative h-9 w-[92px] shrink-0">
        <Image
          src="/brand/logo.svg"
          alt="TAS FLEET Logo"
          fill
          sizes="92px"
          className="object-contain object-left"
          priority
        />
      </div>

      {!compact && displayName ? (
        <div>
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
        </div>
      ) : null}
    </div>
  )
}
