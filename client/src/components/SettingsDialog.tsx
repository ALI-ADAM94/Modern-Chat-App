import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CameraIcon, KeyRoundIcon, Loader2Icon, LogOutIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import { MAX_FILE_SIZE, api, apiPatch, uploadFile } from '@/lib/api'
import { userName } from '@/lib/format'
import type { Me } from '@/lib/types'
import { useChat } from '@/store/chat'

export function SettingsDialog() {
  const open = useChat((s) => s.settingsOpen)
  const set = useChat((s) => s.set)
  const setMe = useChat((s) => s.setMe)

  // Refresh my profile whenever the dialog opens
  useEffect(() => {
    if (open) api<Me>('/api/users/me').then(setMe).catch(() => {})
  }, [open, setMe])

  return (
    <Dialog open={open} onOpenChange={(o) => set({ settingsOpen: o })}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>Manage your profile, password and session.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <ProfileCard />
          <Tabs defaultValue="profile">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile"><UserIcon /> Profile</TabsTrigger>
              <TabsTrigger value="password"><KeyRoundIcon /> Password</TabsTrigger>
              <TabsTrigger value="account"><LogOutIcon /> Account</TabsTrigger>
            </TabsList>
            <TabsContent value="profile"><ProfileForm /></TabsContent>
            <TabsContent value="password"><PasswordForm /></TabsContent>
            <TabsContent value="account"><AccountInfo /></TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

async function saveProfile(changes: Partial<Me>) {
  const me = await apiPatch<Me>('/api/users/me', changes)
  useChat.getState().setMe(me)
  return me
}

function ProfileCard() {
  const me = useChat((s) => s.me)!
  const users = useChat((s) => s.users)
  const rooms = useChat((s) => s.rooms)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function changePhoto(file?: File) {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) return void toast.error('Image is too large (max 50 MB)')
    setBusy(true)
    try {
      const uploaded = await uploadFile(file)
      await saveProfile({ avatar: uploaded.url })
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto() {
    try {
      await saveProfile({ avatar: '' })
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const stats = [
    { label: 'Online', value: users.filter((u) => u.online).length },
    { label: 'Users', value: users.length + 1 },
    { label: 'Rooms', value: rooms.length },
  ]

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <UserAvatar user={me} className="size-24 text-2xl" />
          <Button
            size="icon-sm"
            className="absolute right-0 bottom-0 rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Change photo"
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <CameraIcon />}
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => changePhoto(e.target.files?.[0])} />
        </div>
        <div>
          <p className="font-semibold">{userName(me)}</p>
          <p className="text-xs text-muted-foreground">@{me.username}</p>
        </div>
        <p className="text-sm text-muted-foreground italic">{me.about || 'No about yet'}</p>
        {me.avatar && (
          <Button variant="ghost" size="sm" onClick={removePhoto}>
            <Trash2Icon /> Remove photo
          </Button>
        )}
        <Separator />
        <div className="grid w-full grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted px-1 py-2">
              <p className="text-lg font-semibold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileForm() {
  const me = useChat((s) => s.me)!
  const [form, setForm] = useState({ displayName: '', username: '', email: '', about: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm({ displayName: me.displayName ?? '', username: me.username, email: me.email, about: me.about ?? '' })
  }, [me.displayName, me.username, me.email, me.about])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await saveProfile(form)
      toast.success('Profile saved')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>This is how other people see you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pf-display">Display name</Label>
            <Input id="pf-display" maxLength={50} placeholder="Shown to other users" {...field('displayName')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pf-username">Username</Label>
              <Input id="pf-username" required minLength={3} {...field('username')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pf-email">Email</Label>
              <Input id="pf-email" type="email" required {...field('email')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-about">About</Label>
            <Textarea id="pf-about" maxLength={140} placeholder="Hey there! I am using Chat App." {...field('about')} />
            <p className="text-right text-xs text-muted-foreground">{form.about.length}/140</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="justify-self-end">
            {busy && <Loader2Icon className="animate-spin" />}
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.next !== form.confirm) return setError('New passwords do not match')
    setBusy(true)
    try {
      await apiPatch('/api/users/me/password', { currentPassword: form.current, newPassword: form.next })
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Password updated')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use at least 6 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" required autoComplete="current-password" {...field('current')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" required minLength={6} autoComplete="new-password" {...field('next')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-confirm">Confirm</Label>
              <Input id="pw-confirm" type="password" required minLength={6} autoComplete="new-password" {...field('confirm')} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="justify-self-end">
            {busy && <Loader2Icon className="animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AccountInfo() {
  const me = useChat((s) => s.me)!
  const connected = useChat((s) => s.connected)
  const logout = useChat((s) => s.logout)
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '—')
  const rows = [
    ['Email', me.email],
    ['Member since', fmt(me.createdAt)],
    ['Last updated', fmt(me.updatedAt)],
    ['Status', connected ? 'Connected' : 'Disconnected'],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your account details and session.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-0 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b py-2.5 last:border-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="destructive" onClick={() => logout()} className="justify-self-start">
          <LogOutIcon /> Log out
        </Button>
      </CardContent>
    </Card>
  )
}
