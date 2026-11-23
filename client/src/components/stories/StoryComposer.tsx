import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImageIcon, LinkIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MAX_FILE_SIZE, apiPost, uploadFile } from '@/lib/api'
import { useChat } from '@/store/chat'

const MEDIA_RE = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm|ogg|quicktime))$/

export function StoryComposer() {
  const open = useChat((s) => s.storyComposerOpen)
  const set = useChat((s) => s.set)
  const loadStories = useChat((s) => s.loadStories)
  const [mode, setMode] = useState<'media' | 'link'>('media')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'' | 'Uploading...' | 'Sharing...'>('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset every time it opens
  useEffect(() => {
    if (open) {
      setMode('media')
      setFile(null)
      setPreview(null)
      setLink('')
      setCaption('')
      setError('')
    }
  }, [open])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choose(f?: File) {
    setError('')
    if (!f) return
    if (!MEDIA_RE.test(f.type)) return setError('Choose a photo (png, jpg, gif, webp) or a video (mp4, webm, mov)')
    if (f.size > MAX_FILE_SIZE) return setError('File is too large (max 50 MB)')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      let body
      if (mode === 'media') {
        if (!file) throw new Error('Choose a photo or video first')
        setStatus('Uploading...')
        const uploaded = await uploadFile(file)
        body = { type: uploaded.kind, mediaUrl: uploaded.url, caption }
      } else {
        let url = link.trim()
        if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url
        body = { type: 'link', link: url, caption }
      }
      setStatus('Sharing...')
      await apiPost('/api/stories', body)
      set({ storyComposerOpen: false })
      await loadStories()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStatus('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && set({ storyComposerOpen: false })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to your story</DialogTitle>
          <DialogDescription>Stories are visible to everyone for 24 hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'media' | 'link')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="media"><ImageIcon /> Photo / Video</TabsTrigger>
              <TabsTrigger value="link"><LinkIcon /> Social link</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'media' ? (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {preview && file?.type.startsWith('video/') ? (
                  <video src={preview} muted autoPlay loop playsInline className="max-h-60 rounded-lg" />
                ) : preview ? (
                  <img src={preview} alt="" className="max-h-60 rounded-lg" />
                ) : (
                  <>
                    <UploadIcon className="size-6" />
                    Click to choose a photo or video
                    <span className="text-xs">max 50 MB</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="story-link">Link</Label>
              <Input id="story-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/yourname" />
              <p className="text-xs text-muted-foreground">Instagram, YouTube, TikTok, X, Facebook, LinkedIn, GitHub or any website</p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="story-caption">Caption</Label>
            <Textarea id="story-caption" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => set({ storyComposerOpen: false })}>Cancel</Button>
            <Button type="submit" disabled={!!status}>
              {status && <Loader2Icon className="animate-spin" />}
              {status || 'Share story'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
