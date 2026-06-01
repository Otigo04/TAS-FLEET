import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  compact?: boolean
  className?: string
}

export function CompanyLogo({ compact = false, className }: CompanyLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/30 bg-slate-900/80 shadow-md">
        <Image src="/company-logo.svg" alt="ON Mobility Logo" fill sizes="40px" className="object-cover" priority />
      </div>

      {!compact ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">ON Mobility Portal</p>
          <p className="text-sm font-semibold text-slate-100">Yakup Orhan Tas</p>
        </div>
      ) : null}
    </div>
  )
}
