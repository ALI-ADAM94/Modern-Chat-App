import { useState } from 'react'
import { BanIcon, EllipsisVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AttachmentView } from '@/components/chat/AttachmentView'
import { formatTime, userName } from '@/lib/format'
import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

export function MessageBubble({ message, mine, showName, onMediaLoad }: { message: Message; mine: boolean; showName: boolean; onMediaLoad?: () => void }) {
  const set = useChat((s) => s.set)
  const deleteMessage = useChat((s) => s.deleteMessage)
  const editing = useChat((s) => s.editingId === message._id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={cn('group flex items-end gap-1', mine ? 'justify-end' : 'justify-start')}>
      {mine && !message.deleted && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Message actions"
            >
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => set({ editingId: message._id })}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-xs',
          mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground',
          message.deleted && 'opacity-70',
          editing && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        )}
      >
        {showName && !mine && <p className="mb-0.5 text-xs font-semibold text-primary dark:text-sky-400">{userName(message.user)}</p>}

        {message.deleted ? (
          <p className="flex items-center gap-1.5 italic">
            <BanIcon className="size-3.5" /> This message was deleted
          </p>
        ) : (
          <div className="grid gap-1.5">
            {message.attachment && <AttachmentView attachment={message.attachment} mine={mine} onLoad={onMediaLoad} />}
            {message.text && <p className="break-words whitespace-pre-wrap">{message.text}</p>}
          </div>
        )}

        <p className={cn('mt-0.5 flex justify-end gap-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {message.editedAt && !message.deleted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="italic">edited</span>
              </TooltipTrigger>
              <TooltipContent>Edited {new Date(message.editedAt).toLocaleString()}</TooltipContent>
            </Tooltip>
          )}
          {formatTime(message.createdAt)}
        </p>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed for everyone in the chat. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteMessage(message._id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
