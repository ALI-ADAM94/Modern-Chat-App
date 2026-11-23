import { useState, type FormEvent } from 'react'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api'
import type { Room } from '@/lib/types'
import { useChat } from '@/store/chat'

export function CreateRoomDialog() {
  const open = useChat((s) => s.createRoomOpen)
  const set = useChat((s) => s.set)
  const joinRoom = useChat((s) => s.joinRoom)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function close() {
    set({ createRoomOpen: false })
    setName('')
    setDescription('')
    setIsPrivate(false)
    setError('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const room = await apiPost<Room>('/api/rooms', { name, description, isPrivate })
      useChat.setState((s) => ({ rooms: [room, ...s.rooms] }))
      close()
      joinRoom(room._id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
          <DialogDescription>Group rooms are visible to everyone; private rooms only to members.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="room-name">Name</Label>
            <Input id="room-name" required minLength={3} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. general" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="room-desc">Description</Label>
            <Textarea id="room-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="size-4 accent-primary" />
            Private room
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              Create room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
