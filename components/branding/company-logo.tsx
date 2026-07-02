import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  compact?: boolean
  className?: string
  displayName?: string
  /** md = App-Chrome (Sidebar/Header), lg = Login/Setup-Seiten. */
  size?: 'md' | 'lg'
}

const SIZES = {
  md: { box: 'h-14 w-[188px]', px: '188px' },
  lg: { box: 'h-20 w-[264px]', px: '264px' },
} as const

export function CompanyLogo({ compact = false, className, displayName, size = 'md' }: CompanyLogoProps) {
  const s = SIZES[size]
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div className={cn('relative shrink-0', s.box)}>
        {/* Helle & dunkle Variante — die Wortmarke braucht im Dark Mode helle Schrift. */}
        <Image
          src="/brand/logo.svg"
          alt="TAS FLEET Logo"
          fill
          sizes={s.px}
          className="object-contain object-left dark:hidden"
          priority
        />
        <Image
          src="/brand/logo-dark.svg"
          alt=""
          aria-hidden
          fill
          sizes={s.px}
          className="hidden object-contain object-left dark:block"
          priority
        />
      </div>

      {!compact && displayName ? (
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
        </div>
      ) : null}
    </div>
  )
}
