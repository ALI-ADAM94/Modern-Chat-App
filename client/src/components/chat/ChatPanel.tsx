import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, HashIcon, LockIcon, MessageCircleIcon, WifiIcon, WifiOffIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Composer } from '@/components/chat/Composer'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { UserAvatar } from '@/components/UserAvatar'
import { formatLastSeen, userName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

export function ChatPanel({ className }: { className?: string }) {
  const currentRoomId = useChat((s) => s.currentRoomId)
  const [dropped, setDropped] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <main className={cn('flex min-h-0 min-w-0 flex-col bg-background', className)}>
      <ChatHeader />
      <div
        className={cn('relative flex min-h-0 flex-1 flex-col', dragOver && 'ring-2 ring-primary ring-inset')}
        onDragOver={(e) => {
          if (!currentRoomId) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) setDropped(f)
        }}
      >
        {currentRoomId ? <MessageList /> : <EmptyState />}
      </div>
      <TypingLine />
      <Composer fileDropped={dropped} />
    </main>
  )
}

function ChatHeader() {
  const currentRoomId = useChat((s) => s.currentRoomId)
  const connected = useChat((s) => s.connected)
  const rooms = useChat((s) => s.rooms)
  const users = useChat((s) => s.users)
  const directRoomUser = useChat((s) => s.directRoomUser)
  const typingToMe = useChat((s) => s.typingToMe)

  const otherId = currentRoomId ? directRoomUser[currentRoomId] : undefined
  const other = otherId ? users.find((u) => u._id === otherId) : undefined
  const room = rooms.find((r) => r._id === currentRoomId)

  let title: React.ReactNode = 'No chat selected'
  let subtitle: React.ReactNode = 'Pick a person or a room to start chatting'
  let icon: React.ReactNode = null

  if (other) {
    icon = <UserAvatar user={other} online={other.online} showStatus size="lg" />
    title = userName(other)
    subtitle = typingToMe[other._id] ? (
      <span className="text-emerald-600 italic dark:text-emerald-400">typing...</span>
    ) : other.online ? (
      <span className="text-emerald-600 dark:text-emerald-400">Online</span>
    ) : (
      formatLastSeen(other.lastSeen)
    )
  } else if (room) {
    icon = (
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        {room.isPrivate ? <LockIcon className="size-4" /> : <HashIcon className="size-4" />}
      </div>
    )
    title = room.name
    subtitle = room.description || 'Say hello 👋'
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
      {currentRoomId && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          aria-label="Back to chats"
          onClick={() => useChat.setState({ currentRoomId: null, messages: [] })}
        >
          <ArrowLeftIcon />
        </Button>
      )}
      {icon}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Badge variant="outline" className="gap-1.5">
        {connected ? <WifiIcon className="text-emerald-500" /> : <WifiOffIcon className="text-destructive" />}
        {connected ? 'Connected' : 'Disconnected'}
      </Badge>
    </header>
  )
}

function MessageList() {
  const messages = useChat((s) => s.messages)
  const loading = useChat((s) => s.loadingMessages)
  const me = useChat((s) => s.me)
  const isGroup = useChat((s) => !!s.currentRoomId && s.rooms.some((r) => r._id === s.currentRoomId))
  const ref = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }

  useLayoutEffect(scrollToBottom, [messages.length, loading])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        {[60, 40, 70, 30].map((w, i) => (
          <Skeleton key={i} className={cn('h-10 rounded-2xl', i % 2 ? 'self-end' : 'self-start')} style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Be the first! 👋</p>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {messages.map((m, i) => (
            <MessageBubble
              key={m._id}
              message={m}
              mine={m.user?._id === me?._id}
              showName={isGroup && messages[i - 1]?.user?._id !== m.user?._id}
              onMediaLoad={scrollToBottom}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TypingLine() {
  const typingInRoom = useChat((s) => s.typingInRoom)
  const names = Object.values(typingInRoom)
  return (
    <div className="h-5 px-4 text-xs text-muted-foreground italic">
      {names.length === 1 ? `${names[0]} is typing...` : names.length > 1 ? `${names.join(', ')} are typing...` : ''}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <MessageCircleIcon className="size-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Your messages</p>
        <p className="text-sm text-muted-foreground">Select a person or a room to start chatting.</p>
      </div>
    </div>
  )
}
