import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLinkIcon, EyeIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/UserAvatar'
import { api, apiPost, fileUrl } from '@/lib/api'
import { linkInfo, timeAgo, userName } from '@/lib/format'
import { useChat } from '@/store/chat'

const DURATION = 6000 // ms for photo and link stories

export function StoryViewer() {
  const viewer = useChat((s) => s.storyViewer)
  const groups = useChat((s) => s.storyGroups)
  const me = useChat((s) => s.me)
  const set = useChat((s) => s.set)

  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false) // broken video: fall back to the timer
  const videoRef = useRef<HTMLVideoElement>(null)

  const group = viewer ? groups[viewer.group] : undefined
  const story = viewer && group ? group.stories[viewer.index] : undefined
  const mine = group?.user._id === me?._id

  const close = useCallback(() => {
    set({ storyViewer: null })
    useChat.getState().loadStories().catch(console.error) // pick up anything posted meanwhile
  }, [set])

  const next = useCallback(() => {
    const s = useChat.getState()
    const v = s.storyViewer
    if (!v) return
    const g = s.storyGroups[v.group]
    if (g && v.index < g.stories.length - 1) return set({ storyViewer: { group: v.group, index: v.index + 1 } })
    // Next person's stories (skip mine)
    const nextGroup = s.storyGroups.findIndex((gr, i) => i > v.group && gr.user._id !== s.me?._id)
    if (nextGroup !== -1) return set({ storyViewer: { group: nextGroup, index: 0 } })
    close()
  }, [set, close])

  const prev = () => {
    if (viewer && viewer.index > 0) set({ storyViewer: { ...viewer, index: viewer.index - 1 } })
    else setProgress(0)
  }

  // Reset for each story + mark as seen
  useEffect(() => {
    setProgress(0)
    setShowViewers(false)
    setPaused(false)
    setVideoFailed(false)
    if (!story || mine || story.seen) return
    useChat.setState((s) => ({
      storyGroups: s.storyGroups.map((g, gi) =>
        gi !== viewer!.group
          ? g
          : {
              ...g,
              stories: g.stories.map((st) => (st._id === story._id ? { ...st, seen: true } : st)),
              allSeen: g.stories.every((st) => st.seen || st._id === story._id),
            },
      ),
    }))
    apiPost(`/api/stories/${story._id}/view`).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id])

  // Timer for photos and links (videos follow their own playback)
  useEffect(() => {
    if (!story || (story.type === 'video' && !videoFailed) || paused || showViewers || confirmDelete) return
    const start = performance.now() - progress * DURATION
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      setProgress(p)
      if (p >= 1) return next()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id, paused, showViewers, confirmDelete, videoFailed])

  // Pause/resume videos together with the viewer
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused || showViewers || confirmDelete) v.pause()
    else v.play().catch(() => {})
  }, [paused, showViewers, confirmDelete])

  // Arrow keys
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function remove() {
    if (!story) return
    try {
      await api(`/api/stories/${story._id}`, { method: 'DELETE' })
      toast.success('Story deleted')
      close()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const info = story?.type === 'link' && story.link ? linkInfo(story.link) : null

  return (
    <Dialog open={!!story} onOpenChange={(o) => !o && close()}>
      <DialogContent className="h-[min(92svh,780px)] w-full max-w-[min(440px,100vw)] gap-0 overflow-hidden border-0 bg-black p-0 text-white sm:max-w-[440px]">
        {story && group && (
          <div className="relative flex h-full w-full items-center justify-center">
            {/* progress bars */}
            <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
              {group.stories.map((st, i) => (
                <div key={st._id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full bg-white"
                    style={{ width: i < viewer!.index ? '100%' : i === viewer!.index ? `${progress * 100}%` : '0%' }}
                  />
                </div>
              ))}
            </div>

            {/* header */}
            <div className="absolute inset-x-3 top-6 z-20 flex items-center gap-2.5 pr-10">
              <UserAvatar user={group.user} />
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-semibold text-white">{mine ? 'My story' : userName(group.user)}</DialogTitle>
                <DialogDescription className="text-xs text-white/70">{timeAgo(story.createdAt)}</DialogDescription>
              </div>
            </div>

            {/* content */}
            {story.type === 'image' && <img src={fileUrl(story.mediaUrl)} alt="" className="max-h-full max-w-full object-contain" />}
            {story.type === 'video' && (
              <video
                key={story._id}
                ref={videoRef}
                src={fileUrl(story.mediaUrl)}
                autoPlay
                playsInline
                className="max-h-full max-w-full"
                onTimeUpdate={(e) => {
                  const v = e.currentTarget
                  if (v.duration && isFinite(v.duration)) setProgress(v.currentTime / v.duration)
                }}
                onEnded={next}
                onError={() => setVideoFailed(true)}
              />
            )}
            {story.type === 'video' && videoFailed && (
              <p className="absolute z-20 text-sm text-white/70">This video can't be played</p>
            )}
            {info && (
              <div className="relative z-20 mx-8 w-full rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500 p-7 text-center shadow-xl">
                <ExternalLinkIcon className="mx-auto size-9" />
                <h3 className="mt-3 text-xl font-semibold">{info.name}</h3>
                <p className="mt-1 text-sm break-all text-white/85">{story.link}</p>
                <Button asChild variant="secondary" className="mt-5 rounded-full" onClick={() => setPaused(true)}>
                  {/* link validated as http(s) by the server */}
                  <a href={story.link} target="_blank" rel="noopener noreferrer">
                    Open link <ExternalLinkIcon />
                  </a>
                </Button>
              </div>
            )}

            {story.caption && (
              <div className="absolute inset-x-0 bottom-14 z-20 bg-gradient-to-t from-black/70 to-transparent px-5 pt-8 pb-3 text-center text-sm break-words">
                {story.caption}
              </div>
            )}

            {/* tap zones (also pause while holding) */}
            <button aria-label="Previous story" className="absolute top-20 bottom-20 left-0 z-10 w-1/3" onClick={prev} />
            <button
              aria-label="Next story"
              className="absolute top-20 right-0 bottom-20 z-10 w-1/3"
              onClick={next}
            />
            <div
              className="absolute inset-x-1/3 top-20 bottom-20 z-10"
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
            />

            {/* my story: views, add, delete */}
            {mine && (
              <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center gap-2 p-3">
                <Button size="sm" variant="secondary" onClick={() => setShowViewers((v) => !v)}>
                  <EyeIcon /> {story.viewCount} view{story.viewCount === 1 ? '' : 's'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { close(); set({ storyComposerOpen: true }) }}>
                  <PlusIcon /> Add
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2Icon /> Delete
                </Button>
              </div>
            )}

            {mine && showViewers && (
              <div className="absolute inset-x-3 bottom-14 z-30 max-h-[45%] overflow-y-auto rounded-xl bg-popover p-2 text-popover-foreground shadow-lg">
                {(story.viewers ?? []).length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">No views yet</p>}
                {(story.viewers ?? []).map((v) =>
                  v.user ? (
                    <div key={v.user._id} className="flex items-center gap-3 rounded-lg p-2">
                      <UserAvatar user={v.user} size="sm" />
                      <span className="flex-1 truncate text-sm">{userName(v.user)}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(v.viewedAt)}</span>
                    </div>
                  ) : null,
                )}
              </div>
            )}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this story?</AlertDialogTitle>
                  <AlertDialogDescription>It will disappear for everyone right away.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
