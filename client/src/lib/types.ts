// Shapes of the data the backend sends (see Plan.md)

export interface PublicUser {
  _id: string
  username: string
  displayName?: string
  avatar?: string
  about?: string
}

export interface User extends PublicUser {
  lastSeen?: string | null
  online?: boolean
}

export interface Me extends PublicUser {
  email: string
  createdAt?: string
  updatedAt?: string
}

export interface Room {
  _id: string
  name: string
  description?: string
  isPrivate?: boolean
  isDirect?: boolean
  createdBy?: PublicUser
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

export interface Attachment {
  url: string
  name: string
  mimeType: string
  size: number
  kind?: AttachmentKind
  isImage?: boolean
}

export interface Message {
  _id: string
  room: string
  user: PublicUser
  text: string
  attachment?: Attachment | null
  editedAt?: string | null
  deleted?: boolean
  createdAt: string
}

export interface StoryViewer {
  user: PublicUser
  viewedAt: string
}

export interface Story {
  _id: string
  user: PublicUser
  type: 'image' | 'video' | 'link'
  mediaUrl?: string
  link?: string
  caption?: string
  createdAt: string
  expiresAt: string
  seen: boolean
  viewCount: number
  viewers?: StoryViewer[] // only for my own stories
}

export interface StoryGroup {
  user: PublicUser
  stories: Story[]
  allSeen: boolean
}
