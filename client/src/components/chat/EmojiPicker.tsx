import { useState } from 'react'
import { ClockIcon, SmileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EMOJI_CATEGORIES, addRecentEmoji, getRecentEmojis } from '@/lib/emojis'
import { cn } from '@/lib/utils'

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<string>('recent')
  const recent = getRecentEmojis()
  const activeTab = tab === 'recent' && recent.length === 0 ? EMOJI_CATEGORIES[0].icon : tab
  const list = activeTab === 'recent' ? recent : EMOJI_CATEGORIES.find((c) => c.icon === activeTab)?.emojis ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="Emoji">
          <SmileIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 gap-0 p-0">
        <div className="flex border-b">
          <TabButton active={activeTab === 'recent'} onClick={() => setTab('recent')} title="Recent">
            <ClockIcon className="size-4" />
          </TabButton>
          {EMOJI_CATEGORIES.map((c) => (
            <TabButton key={c.icon} active={activeTab === c.icon} onClick={() => setTab(c.icon)} title={c.label}>
              {c.icon}
            </TabButton>
          ))}
        </div>
        <div className="grid h-56 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
          {list.length === 0 && <p className="col-span-8 py-8 text-center text-sm text-muted-foreground">No recent emojis yet</p>}
          {list.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md py-1 text-xl leading-tight hover:bg-accent"
              onClick={() => {
                addRecentEmoji(emoji)
                onPick(emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TabButton({ active, children, ...props }: React.ComponentProps<'button'> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex flex-1 items-center justify-center border-b-2 border-transparent py-2 text-base hover:bg-accent',
        active && 'border-primary bg-accent/60',
      )}
      {...props}
    >
      {children}
    </button>
  )
}
