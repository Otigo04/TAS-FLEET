import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950',
        secondary: 'border-transparent bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
        success: 'border-emerald-200 dark:border-emerald-900 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300',
        warning: 'border-amber-200 dark:border-amber-900 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300',
        danger: 'border-rose-200 dark:border-rose-900 bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
