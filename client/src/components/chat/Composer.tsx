import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FilmIcon, Loader2Icon, MusicIcon, PaperclipIcon, PencilIcon, SendHorizontalIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileTypeIcon } from '@/components/chat/AttachmentView'
import { EmojiPicker } from '@/components/chat/EmojiPicker'
import { MAX_FILE_SIZE, uploadFile } from '@/lib/api'
import { formatSize } from '@/lib/format'
import { useChat } from '@/store/chat'

export function Composer({ fileDropped }: { fileDropped: File | null }) {
  const currentRoomId = useChat((s) => s.currentRoomId)
  const connected = useChat((s) => s.connected)
  const editingId = useChat((s) => s.editingId)
  const messages = useChat((s) => s.messages)
  const me = useChat((s) => s.me)
  const { sendMessage, editMessage, typing, set } = useChat.getState()

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const isTyping = useRef(false)

  const enabled = !!currentRoomId && connected
  const editing = messages.find((m) => m._id === editingId)

  // Start editing: put the message text in the box
  useEffect(() => {
    if (editing) {
      clearFile()
      setText(editing.text)
      requestAnimationFrame(() => inputRef.current?.select())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // Reset when switching chats
  useEffect(() => {
    setText('')
    clearFile()
  }, [currentRoomId])

  // File dropped on the message list
  useEffect(() => {
    if (fileDropped) pickFile(fileDropped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileDropped])

  function pickFile(f: File | undefined | null) {
    if (!f || !currentRoomId || uploading) return
    if (f.size > MAX_FILE_SIZE) return void toast.error(`"${f.name}" is too large (max 50 MB)`)
    set({ editingId: null })
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(/^image\/(png|jpeg|gif|webp)$/.test(f.type) ? URL.createObjectURL(f) : null)
    inputRef.current?.focus()
  }

  function clearFile() {
    setFile(null)
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p)
      return null
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function stopTyping() {
    window.clearTimeout(typingTimer.current)
    if (isTyping.current) typing(false)
    isTyping.current = false
  }

  function onChange(value: string) {
    setText(value)
    if (!enabled || editingId) return
    if (!isTyping.current) {
      isTyping.current = true
      typing(true)
    }
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(stopTyping, 1500)
  }

  function cancelEdit() {
    set({ editingId: null })
    setText('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!enabled || uploading) return
    const value = text.trim()

    if (editingId) {
      if (value && value !== editing?.text) editMessage(editingId, value)
      else set({ editingId: null })
      setText('')
      return
    }

    if (!value && !file) return
    let attachment = null
    if (file) {
      setUploading(true)
      try {
        attachment = await uploadFile(file)
      } catch (err) {
        toast.error('Upload failed: ' + (err as Error).message)
        return
      } finally {
        setUploading(false)
      }
    }
    sendMessage(value, attachment)
    stopTyping()
    clearFile()
    setText('')
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      cancelEdit()
      clearFile()
    }
    // Arrow-up on an empty box edits your last message
    if (e.key === 'ArrowUp' && !text && !editingId) {
      const last = [...messages].reverse().find((m) => m.user._id === me?._id && !m.deleted)
      if (last) {
        e.preventDefault()
        set({ editingId: last._id })
      }
    }
  }

  function insertEmoji(emoji: string) {
    const input = inputRef.current
    const start = input?.selectionStart ?? text.length
    const end = input?.selectionEnd ?? text.length
    onChange(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  return (
    <div className="border-t bg-background">
      {editing && (
        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm">
          <PencilIcon className="size-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Editing message</p>
            <p className="truncate text-xs text-muted-foreground">{editing.text || '(file)'}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={cancelEdit} aria-label="Cancel editing">
            <XIcon />
          </Button>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2 text-sm">
          {preview ? (
            <img src={preview} alt="" className="size-11 rounded-md object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-md bg-background">
              {file.type.startsWith('video/') ? <FilmIcon className="size-5" /> : file.type.startsWith('audio/') ? <MusicIcon className="size-5" /> : <FileTypeIcon name={file.name} className="size-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={clearFile} disabled={uploading} aria-label="Remove file">
            <XIcon />
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-1.5 p-3">
        <EmojiPicker onPick={insertEmoji} disabled={!enabled} />
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" disabled={!enabled || uploading || !!editingId} onClick={() => fileRef.current?.click()} aria-label="Attach file">
              <PaperclipIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Attach a file, image, video or audio (max 50 MB)</TooltipContent>
        </Tooltip>
        <Input
          ref={inputRef}
          value={text}
          disabled={!enabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pasted = e.clipboardData.files[0]
            if (pasted) {
              e.preventDefault()
              pickFile(pasted)
            }
          }}
          placeholder={!currentRoomId ? 'Select a chat first...' : file ? 'Add a caption (optional)...' : editingId ? 'Edit your message...' : 'Type a message...'}
          className="h-10 flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon-lg" disabled={!enabled || uploading || (!text.trim() && !file)} aria-label={editingId ? 'Save' : 'Send'}>
          {uploading ? <Loader2Icon className="animate-spin" /> : <SendHorizontalIcon />}
        </Button>
      </form>
    </div>
  )
}
