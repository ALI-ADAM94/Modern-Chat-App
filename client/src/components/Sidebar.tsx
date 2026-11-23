import { useMemo, useState } from 'react'
import { HashIcon, LockIcon, LogOutIcon, MessageCircleIcon, PlusIcon, SearchIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StoriesBar } from '@/components/stories/StoriesBar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatar } from '@/components/UserAvatar'
import { formatLastSeen, userName } from '@/lib/format'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

/** Wrap matches of `query` in <mark> */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase()
  let i = 0
  let at: number
  while ((at = lower.indexOf(query, i)) !== -1) {
    parts.push(text.slice(i, at))
    parts.push(
      <mark key={at} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">
        {text.slice(at, at + query.length)}
      </mark>,
    )
    i = at + query.length
  }
  parts.push(text.slice(i))
  return <>{parts}</>
}

export function Sidebar({ className }: { className?: string }) {
  const me = useChat((s) => s.me)!
  const logout = useChat((s) => s.logout)
  const set = useChat((s) => s.set)
  const [tab, setTab] = useState('chats')
  const [query, setQuery] = useState('')

  return (
    <aside className={cn('flex min-h-0 flex-col border-r bg-sidebar text-sidebar-foreground', className)}>
      {/* Profile header */}
      <div className="flex items-center gap-2 border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
              <UserAvatar user={me} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userName(me)}</p>
                <p className="truncate text-xs text-muted-foreground">{me.about || me.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate">@{me.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => set({ settingsOpen: true })}>
              <SettingsIcon /> Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => set({ storyComposerOpen: true })}>
              <PlusIcon /> Add to story
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
              <LogOutIcon /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>

      <div className="px-3 pt-3">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setQuery('') }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chats">
              <MessageCircleIcon /> Chats
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <UsersIcon /> Rooms
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'chats' && <StoriesBar />}

      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'chats' ? 'Search name, username or about' : 'Search rooms'}
            className="pl-8"
          />
        </div>
        {tab === 'rooms' && (
          <Button size="icon" variant="outline" onClick={() => set({ createRoomOpen: true })} aria-label="Create room">
            <PlusIcon />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {tab === 'chats' ? <UserList query={query.trim().toLowerCase()} /> : <RoomList query={query.trim().toLowerCase()} />}
      </ScrollArea>
    </aside>
  )
}

function statusOf(user: User, typing: boolean) {
  if (typing) return { text: 'typing...', className: 'text-emerald-600 italic dark:text-emerald-400' }
  if (user.online) return { text: 'Online', className: 'text-emerald-600 dark:text-emerald-400' }
  return { text: formatLastSeen(user.lastSeen), className: 'text-muted-foreground' }
}

function UserList({ query }: { query: string }) {
  const users = useChat((s) => s.users)
  const unread = useChat((s) => s.unread)
  const typingToMe = useChat((s) => s.typingToMe)
  const currentRoomId = useChat((s) => s.currentRoomId)
  const directRoomUser = useChat((s) => s.directRoomUser)
  const openDirectChat = useChat((s) => s.openDirectChat)
  const activeUserId = currentRoomId ? directRoomUser[currentRoomId] : undefined

  const shown = useMemo(
    () =>
      users
        .filter((u) => !query || [userName(u), u.username, u.about ?? ''].some((v) => v.toLowerCase().includes(query)))
        .sort((a, b) => Number(!!b.online) - Number(!!a.online) || userName(a).localeCompare(userName(b))),
    [users, query],
  )

  if (shown.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        {users.length ? `No users match "${query}"` : 'No other users yet'}
      </p>
    )
  }

  return (
    <div className="grid gap-0.5 px-2 pb-3">
      {query && <p className="px-2 pb-1 text-xs text-muted-foreground">{shown.length} of {users.length} users</p>}
      {shown.map((user) => {
        const status = statusOf(user, !!typingToMe[user._id])
        const count = unread[user._id]
        return (
          <button
            key={user._id}
            onClick={() => openDirectChat(user._id)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent',
              activeUserId === user._id && 'bg-sidebar-accent',
            )}
          >
            <UserAvatar user={user} online={user.online} showStatus size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                <Highlight text={userName(user)} query={query} />
                {user.displayName && query && user.username.toLowerCase().includes(query) && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    @<Highlight text={user.username} query={query} />
                  </span>
                )}
              </p>
              <p className={cn('truncate text-xs', status.className)}>{status.text}</p>
            </div>
            {count ? <Badge className="rounded-full bg-emerald-500 text-white">{count > 99 ? '99+' : count}</Badge> : null}
          </button>
        )
      })}
    </div>
  )
}

function RoomList({ query }: { query: string }) {
  const rooms = useChat((s) => s.rooms)
  const currentRoomId = useChat((s) => s.currentRoomId)
  const joinRoom = useChat((s) => s.joinRoom)

  const shown = rooms.filter(
    (r) => !query || r.name.toLowerCase().includes(query) || (r.description ?? '').toLowerCase().includes(query),
  )

  if (shown.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        {rooms.length ? `No rooms match "${query}"` : 'No rooms yet. Create one with +'}
      </p>
    )
  }

  return (
    <div className="grid gap-0.5 px-2 pb-3">
      {shown.map((room) => (
        <button
          key={room._id}
          onClick={() => joinRoom(room._id)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent',
            currentRoomId === room._id && 'bg-sidebar-accent',
          )}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {room.isPrivate ? <LockIcon className="size-4" /> : <HashIcon className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              <Highlight text={room.name} query={query} />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {room.description || `by ${room.createdBy?.username ?? 'unknown'}`}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
