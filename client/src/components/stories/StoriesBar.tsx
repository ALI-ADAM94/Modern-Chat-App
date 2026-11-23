import { PlusIcon } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { userName } from '@/lib/format'
import type { PublicUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

/** Horizontal row of story circles: "My story" first, then everyone with active stories. */
export function StoriesBar() {
  const me = useChat((s) => s.me)!
  const groups = useChat((s) => s.storyGroups)
  const set = useChat((s) => s.set)

  const myIndex = groups.findIndex((g) => g.user._id === me._id)

  return (
    <div className="flex gap-3 overflow-x-auto border-b px-3 pt-3 pb-3 [scrollbar-width:thin]">
      <StoryCircle
        user={me}
        label="My story"
        ring={myIndex === -1 ? 'none' : 'mine'}
        onClick={() =>
          myIndex === -1 ? set({ storyComposerOpen: true }) : set({ storyViewer: { group: myIndex, index: 0 } })
        }
        onAdd={() => set({ storyComposerOpen: true })}
      />
      {groups.map((group, index) =>
        group.user._id === me._id ? null : (
          <StoryCircle
            key={group.user._id}
            user={group.user}
            label={userName(group.user)}
            ring={group.allSeen ? 'seen' : 'unseen'}
            onClick={() =>
              set({ storyViewer: { group: index, index: Math.max(0, group.stories.findIndex((st) => !st.seen)) } })
            }
          />
        ),
      )}
    </div>
  )
}

function StoryCircle({
  user,
  label,
  ring,
  onClick,
  onAdd,
}: {
  user: PublicUser
  label: string
  ring: 'unseen' | 'seen' | 'mine' | 'none'
  onClick: () => void
  onAdd?: () => void
}) {
  return (
    <div className="relative flex w-16 shrink-0 flex-col items-center gap-1">
      <button
        onClick={onClick}
        title={label}
        className={cn(
          'rounded-full p-[2.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ring === 'unseen' && 'bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600',
          ring === 'mine' && 'bg-gradient-to-tr from-emerald-400 to-sky-500',
          ring === 'seen' && 'bg-muted-foreground/30',
          ring === 'none' && 'border-2 border-dashed border-muted-foreground/40 p-[1px]',
        )}
      >
        <div className="rounded-full bg-sidebar p-[2px]">
          <UserAvatar user={user} size="lg" className="size-12" />
        </div>
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label="Add story"
          className="absolute top-9 right-1 flex size-5 items-center justify-center rounded-full border-2 border-sidebar bg-primary text-primary-foreground"
        >
          <PlusIcon className="size-3" />
        </button>
      )}
      <span className="w-full truncate text-center text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
