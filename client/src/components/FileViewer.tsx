import { useEffect, useState } from 'react'
import { DownloadIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FileTypeIcon } from '@/components/chat/AttachmentView'
import { fileUrl } from '@/lib/api'
import { TEXT_EXTS, extOf, formatSize, kindOf } from '@/lib/format'
import type { Attachment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

/** Full-screen viewer for images, videos, audio, PDFs and text files. */
export function FileViewer() {
  const attachment = useChat((s) => s.fileViewer)
  const set = useChat((s) => s.set)

  return (
    <Dialog open={!!attachment} onOpenChange={(o) => !o && set({ fileViewer: null })}>
      <DialogContent className="flex h-[90svh] w-[95vw] max-w-[95vw] flex-col gap-0 overflow-hidden bg-zinc-950 p-0 text-white sm:max-w-5xl">
        {attachment && <ViewerBody attachment={attachment} />}
      </DialogContent>
    </Dialog>
  )
}

function ViewerBody({ attachment }: { attachment: Attachment }) {
  const url = fileUrl(attachment.url)
  const kind = kindOf(attachment)
  const ext = extOf(attachment.name)
  const [zoomed, setZoomed] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isPdf = kind === 'file' && ext === 'pdf'
  const isText = kind === 'file' && TEXT_EXTS.includes(ext) && attachment.size <= 1024 * 1024

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (isPdf || isText) {
      setLoading(true)
      fetch(url)
        .then(async (res) => {
          if (isPdf) {
            // The server sends files as downloads; re-wrap so the browser's PDF viewer can show them
            objectUrl = URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }))
            if (!cancelled) setPdfUrl(objectUrl)
          } else {
            const t = await res.text()
            if (!cancelled) setText(t)
          }
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false))
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, isPdf, isText])

  let body: React.ReactNode
  if (kind === 'image') {
    body = (
      <img
        src={url}
        alt={attachment.name}
        onClick={() => setZoomed((z) => !z)}
        className={cn('rounded-md', zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
      />
    )
  } else if (kind === 'video') {
    body = <video src={url} controls autoPlay playsInline className="max-h-full max-w-full rounded-md" />
  } else if (kind === 'audio') {
    body = <audio src={url} controls autoPlay className="w-full max-w-md" />
  } else if (loading) {
    body = <Loader2Icon className="size-8 animate-spin opacity-70" />
  } else if (isPdf && pdfUrl) {
    body = <iframe src={pdfUrl} title={attachment.name} className="h-full w-full rounded-md bg-white" />
  } else if (isText && text !== null) {
    // Shown as plain text, never as HTML
    body = <pre className="h-full w-full overflow-auto rounded-md bg-zinc-900 p-4 text-left text-xs whitespace-pre-wrap text-zinc-100">{text}</pre>
  } else {
    body = (
      <div className="grid justify-items-center gap-3 text-center">
        <FileTypeIcon name={attachment.name} className="size-16 opacity-70" />
        <p className="text-sm text-zinc-300">No preview for this file type.</p>
        <Button asChild variant="secondary">
          <a href={url} download={attachment.name}>
            <DownloadIcon /> Download
          </a>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 py-2.5 pr-12 pl-4">
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-sm font-medium text-white">{attachment.name}</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{formatSize(attachment.size)}</DialogDescription>
        </div>
        <Button asChild size="sm" variant="secondary">
          <a href={url} download={attachment.name}>
            <DownloadIcon /> Download
          </a>
        </Button>
        {kind !== 'file' && (
          <Button asChild size="sm" variant="secondary">
            <a href={url} target="_blank" rel="noopener">
              <ExternalLinkIcon /> Open
            </a>
          </Button>
        )}
      </div>
      <div className={cn('flex min-h-0 flex-1 items-center justify-center p-4', zoomed && 'items-start justify-start overflow-auto')}>
        {body}
      </div>
    </>
  )
}
