import { cn } from '@/lib/utils'

interface UserAvatarProps {
  avatarUrl?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-sm',
}

/** Derive up to two uppercase initials from a display name. */
function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/**
 * The signed-in user's profile picture. Falls back to a gradient chip with
 * the user's initials when no avatar has been set. Avatars are stored as
 * data URLs (see AvatarUploadCrop), so a plain <img> is the right fit.
 */
export function UserAvatar({ avatarUrl, name, size = 'md', className }: UserAvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        'font-semibold text-white ring-1 ring-black/5',
        'bg-brand-600',
        SIZE[size],
        className,
      )}
      aria-hidden="true"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
