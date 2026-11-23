import { FileArchiveIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, PlayIcon } from 'lucide-react'
import { fileUrl } from '@/lib/api'
import { TEXT_EXTS, extOf, formatSize, kindOf } from '@/lib/format'
import type { Attachment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const ext = extOf(name)
  if (ext === 'pdf' || TEXT_EXTS.includes(ext) || ['doc', 'docx'].includes(ext)) return <FileTextIcon className={className} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchiveIcon className={className} />
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheetIcon className={className} />
  return <FileIcon className={className} />
}

/** How an attachment looks inside a message bubble. Click opens the full viewer. */
export function AttachmentView({ attachment, mine, onLoad }: { attachment: Attachment; mine: boolean; onLoad?: () => void }) {
  const open = () => useChat.getState().set({ fileViewer: attachment })
  const url = fileUrl(attachment.url)
  const kind = kindOf(attachment)

  if (kind === 'image') {
    return (
      <button onClick={open} className="block overflow-hidden rounded-lg">
        <img src={url} alt={attachment.name} loading="lazy" onLoad={onLoad} className="max-h-64 max-w-64 cursor-zoom-in object-cover" />
      </button>
    )
  }

  if (kind === 'video') {
    return (
      <button onClick={open} className="relative block overflow-hidden rounded-lg bg-black" title={'Play ' + attachment.name}>
        <video src={url} preload="metadata" muted playsInline onLoadedMetadata={onLoad} className="max-h-56 max-w-64" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <PlayIcon className="size-5 fill-current" />
          </span>
        </span>
      </button>
    )
  }

  if (kind === 'audio') {
    return (
      <div className="grid gap-1">
        <audio controls preload="metadata" src={url} className="max-w-64" />
        <span className={cn('text-xs', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {attachment.name} · {formatSize(attachment.size)}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={open}
      className={cn(
        'flex max-w-64 items-center gap-3 rounded-lg p-2.5 text-left',
        mine ? 'bg-primary-foreground/15' : 'bg-background/60 dark:bg-background/30',
      )}
    >
      <FileTypeIcon name={attachment.name} className="size-8 shrink-0 opacity-80" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className={cn('text-xs', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {formatSize(attachment.size)} · Click to view
        </span>
      </span>
    </button>
  )
}
