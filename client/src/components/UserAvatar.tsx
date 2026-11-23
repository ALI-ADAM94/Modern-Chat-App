import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { fileUrl } from '@/lib/api'
import { colorFor, initials, userName } from '@/lib/format'
import type { PublicUser } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  user: PublicUser
  online?: boolean
  showStatus?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

/** Avatar with photo (if any), colored initials fallback and an optional online dot. */
export function UserAvatar({ user, online, showStatus = false, size = 'default', className }: Props) {
  return (
    <Avatar size={size} className={className}>
      {user.avatar && <AvatarImage src={fileUrl(user.avatar)} alt={userName(user)} />}
      <AvatarFallback className={cn('font-semibold text-white', colorFor(user._id))}>{initials(user)}</AvatarFallback>
      {showStatus && (
        <AvatarBadge
          className={cn('transition-colors', online ? 'bg-emerald-500' : 'bg-muted-foreground/50')}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </Avatar>
  )
}
