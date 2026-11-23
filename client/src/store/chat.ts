import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { API_URL, ApiError, api, apiPost, getToken, setToken } from '@/lib/api'
import type { Attachment, Me, Message, Room, StoryGroup, User } from '@/lib/types'

// One socket for the whole app (kept outside React state)
let socket: Socket | null = null

interface ChatState {
  // auth
  me: Me | null
  booting: boolean

  // data
  users: User[]
  rooms: Room[]
  storyGroups: StoryGroup[]
  messages: Message[]
  currentRoomId: string | null
  loadingMessages: boolean
  connected: boolean

  directRoomUser: Record<string, string> // direct roomId -> other userId
  userDirectRoom: Record<string, string> // userId -> direct roomId
  unread: Record<string, number> // userId -> unread count
  typingToMe: Record<string, boolean> // userIds typing in a direct chat with me
  typingInRoom: Record<string, string> // userId -> username (current group room)

  // UI
  editingId: string | null
  settingsOpen: boolean
  createRoomOpen: boolean
  storyComposerOpen: boolean
  storyViewer: { group: number; index: number } | null
  fileViewer: Attachment | null

  // actions
  boot: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: (message?: string) => void
  setMe: (me: Me) => void
  loadUsers: () => Promise<void>
  loadRooms: () => Promise<void>
  loadStories: () => Promise<void>
  joinRoom: (roomId: string) => void
  openDirectChat: (userId: string) => Promise<void>
  sendMessage: (text: string, attachment?: Attachment | null) => void
  editMessage: (messageId: string, text: string) => void
  deleteMessage: (messageId: string) => void
  typing: (active: boolean) => void
  set: (partial: Partial<ChatState>) => void
}

const emptyData = {
  users: [],
  rooms: [],
  storyGroups: [],
  messages: [],
  currentRoomId: null,
  loadingMessages: false,
  connected: false,
  directRoomUser: {},
  userDirectRoom: {},
  unread: {},
  typingToMe: {},
  typingInRoom: {},
  editingId: null,
  settingsOpen: false,
  createRoomOpen: false,
  storyComposerOpen: false,
  storyViewer: null,
  fileViewer: null,
}

export const useChat = create<ChatState>((set, get) => {
  const linkDirectRoom = (roomId: string, userId: string) =>
    set((s) => ({
      directRoomUser: { ...s.directRoomUser, [roomId]: userId },
      userDirectRoom: { ...s.userDirectRoom, [userId]: roomId },
    }))

  const without = <T,>(obj: Record<string, T>, key: string) => {
    const copy = { ...obj }
    delete copy[key]
    return copy
  }

  const updateUser = (userId: string, patch: Partial<User>) =>
    set((s) => ({ users: s.users.map((u) => (u._id === userId ? { ...u, ...patch } : u)) }))

  async function startSession() {
    await Promise.all([get().loadRooms(), get().loadUsers()])
    get().loadStories().catch(console.error)
    connectSocket()
  }

  function connectSocket() {
    socket?.disconnect()
    socket = io(API_URL || undefined, { auth: { token: getToken() } })

    socket.on('connect', () => {
      set({ connected: true })
      const roomId = get().currentRoomId
      if (roomId) socket?.emit('join-room', { roomId }) // re-join after reconnect
    })
    socket.on('disconnect', () => set({ connected: false }))
    socket.on('connect_error', (err) => {
      set({ connected: false })
      if (/auth/i.test(err.message)) get().logout(err.message)
    })
    socket.on('error', (msg: string) => toast.error(String(msg)))

    // ----- Rooms & messages -----
    socket.on('joined-room', async ({ roomId }: { roomId: string }) => {
      const prev = get().currentRoomId
      if (prev && prev !== roomId) socket?.emit('leave-room', { roomId: prev })
      const otherId = get().directRoomUser[roomId]
      set((s) => ({
        currentRoomId: roomId,
        unread: otherId ? without(s.unread, otherId) : s.unread,
        typingInRoom: {},
        editingId: null,
      }))
      if (prev === roomId) return
      set({ loadingMessages: true, messages: [] })
      try {
        const history = await api<Message[]>(`/api/rooms/${roomId}/messages`)
        if (get().currentRoomId === roomId) set({ messages: history.reverse() })
      } catch {
        toast.error('Could not load message history')
      } finally {
        set({ loadingMessages: false })
      }
    })

    socket.on('new-message', (msg: Message) => {
      const roomId = String(msg.room)
      const senderId = String(msg.user?._id ?? '')
      const fromMe = senderId === get().me?._id

      // A message for a room we aren't viewing can only be a direct message
      if (roomId !== get().currentRoomId) {
        if (fromMe) return // sent from another tab of mine
        linkDirectRoom(roomId, senderId)
        set((s) => ({
          unread: { ...s.unread, [senderId]: (s.unread[senderId] ?? 0) + 1 },
          typingToMe: without(s.typingToMe, senderId),
        }))
        const sender = get().users.find((u) => u._id === senderId)
        toast(sender ? sender.displayName || sender.username : 'New message', {
          description: msg.text || (msg.attachment ? '📎 ' + msg.attachment.name : ''),
        })
        return
      }
      set((s) => ({
        messages: [...s.messages, msg],
        typingToMe: without(s.typingToMe, senderId),
        typingInRoom: without(s.typingInRoom, senderId),
      }))
    })

    socket.on('message-updated', (u: { _id: string; text: string; editedAt: string }) => {
      set((s) => ({
        messages: s.messages.map((m) => (m._id === u._id ? { ...m, text: u.text, editedAt: u.editedAt } : m)),
        editingId: s.editingId === u._id ? null : s.editingId,
      }))
    })

    socket.on('message-deleted', ({ _id }: { _id: string }) => {
      set((s) => ({
        messages: s.messages.map((m) => (m._id === _id ? { ...m, deleted: true, text: '', attachment: null } : m)),
        editingId: s.editingId === _id ? null : s.editingId,
      }))
    })

    // ----- Presence -----
    socket.on('online-users', (ids: string[]) => {
      const online = new Set(ids.map(String))
      set((s) => ({ users: s.users.map((u) => ({ ...u, online: online.has(u._id) })) }))
    })
    socket.on('user-online', ({ userId }: { userId: string }) => {
      if (get().users.some((u) => u._id === userId)) updateUser(userId, { online: true })
      else get().loadUsers().catch(console.error) // someone new registered
    })
    socket.on('user-offline', ({ userId, lastSeen }: { userId: string; lastSeen: string }) => {
      updateUser(userId, { online: false, lastSeen })
      set((s) => ({ typingToMe: without(s.typingToMe, userId) }))
    })
    socket.on('user-updated', (profile: User) => {
      if (profile._id === get().me?._id) {
        set((s) => ({ me: s.me ? { ...s.me, ...profile } : s.me }))
        return
      }
      if (get().users.some((u) => u._id === profile._id)) updateUser(profile._id, profile)
      else set((s) => ({ users: [...s.users, { ...profile, online: true }] }))
    })

    // ----- Typing -----
    const isGroupRoom = (roomId: string) => get().rooms.some((r) => r._id === roomId)
    socket.on('user-typing', ({ roomId, userId, username }: { roomId: string; userId: string; username: string }) => {
      if (!isGroupRoom(roomId)) {
        linkDirectRoom(roomId, userId)
        set((s) => ({ typingToMe: { ...s.typingToMe, [userId]: true } }))
      } else if (roomId === get().currentRoomId) {
        set((s) => ({ typingInRoom: { ...s.typingInRoom, [userId]: username } }))
      }
    })
    socket.on('user-stop-typing', ({ userId }: { userId: string }) => {
      set((s) => ({ typingToMe: without(s.typingToMe, userId), typingInRoom: without(s.typingInRoom, userId) }))
    })

    // ----- Stories -----
    const refreshStories = () => {
      if (!get().storyViewer) get().loadStories().catch(console.error)
    }
    socket.on('story-added', refreshStories)
    socket.on('story-deleted', refreshStories)
    socket.on('story-viewed', ({ storyId, viewCount }: { storyId: string; viewCount: number }) => {
      if (!get().storyViewer) return refreshStories()
      // Viewer open: only update the counter (reloading could reorder the stories)
      set((s) => ({
        storyGroups: s.storyGroups.map((g) => ({
          ...g,
          stories: g.stories.map((st) => (st._id === storyId ? { ...st, viewCount } : st)),
        })),
      }))
    })
  }

  return {
    me: null,
    booting: true,
    ...emptyData,

    set: (partial) => set(partial),

    boot: async () => {
      if (!getToken()) return set({ booting: false })
      try {
        const me = await api<Me>('/api/users/me')
        set({ me })
        await startSession()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setToken(null)
        else toast.error('Could not reach the server')
        set({ me: null })
      } finally {
        set({ booting: false })
      }
    },

    login: async (email, password) => {
      const data = await apiPost<{ token: string; user: Me }>('/api/auth/login', { email, password })
      setToken(data.token)
      set({ me: data.user, ...emptyData })
      await startSession()
    },

    register: async (username, email, password) => {
      await apiPost('/api/auth/register', { username, email, password })
      // Registration doesn't return a token, so log in right away
      await get().login(email, password)
    },

    logout: (message) => {
      socket?.disconnect()
      socket = null
      setToken(null)
      set({ me: null, ...emptyData })
      if (message) toast.error(message)
    },

    setMe: (me) => set({ me }),

    loadUsers: async () => set({ users: await api<User[]>('/api/users') }),
    loadRooms: async () => set({ rooms: await api<Room[]>('/api/rooms') }),
    loadStories: async () => set({ storyGroups: await api<StoryGroup[]>('/api/stories') }),

    joinRoom: (roomId) => {
      if (!socket?.connected) return void toast.error('Not connected to the server yet')
      if (roomId === get().currentRoomId) return
      socket.emit('join-room', { roomId })
    },

    openDirectChat: async (userId) => {
      try {
        let roomId = get().userDirectRoom[userId]
        if (!roomId) {
          const room = await apiPost<Room>(`/api/rooms/direct/${userId}`)
          roomId = room._id
          linkDirectRoom(roomId, userId)
        }
        get().joinRoom(roomId)
      } catch (err) {
        toast.error('Could not open chat: ' + (err as Error).message)
      }
    },

    sendMessage: (text, attachment) => {
      const roomId = get().currentRoomId
      if (!socket?.connected || !roomId) return
      // The server sends "new-message" back to everyone in the room, including us
      socket.emit('send-message', { roomId, text, attachment: attachment ?? null })
    },

    editMessage: (messageId, text) => {
      socket?.emit('edit-message', { messageId, text })
      set({ editingId: null })
    },

    deleteMessage: (messageId) => socket?.emit('delete-message', { messageId }),

    typing: (active) => {
      const roomId = get().currentRoomId
      if (socket?.connected && roomId) socket.emit(active ? 'typing-start' : 'typing-stop', { roomId })
    },
  }
})
