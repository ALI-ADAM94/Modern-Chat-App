import type { Attachment, AttachmentKind, PublicUser } from './types'

export const userName = (u?: PublicUser | null) => (u ? u.displayName || u.username : 'Unknown')

export const initials = (u?: PublicUser | null) => {
  const name = userName(u).trim()
  const parts = name.split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Stable color per user for avatar fallbacks */
export function colorFor(id: string) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-orange-500',
    'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500',
  ]
  let hash = 0
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export const formatTime = (date: string | number | Date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function formatLastSeen(date?: string | null) {
  if (!date) return 'Offline'
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return `last seen today at ${formatTime(d)}`
  if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${formatTime(d)}`
  return `last seen ${d.toLocaleDateString()} at ${formatTime(d)}`
}

export function timeAgo(date: string) {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (sec < 60) return 'just now'
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago'
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago'
  return Math.floor(sec / 86400) + 'd ago'
}

export const kindOf = (att: Attachment): AttachmentKind => att.kind || (att.isImage ? 'image' : 'file')

export const extOf = (name: string) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || ''

export const TEXT_EXTS = ['txt', 'md', 'json', 'csv', 'log', 'js', 'ts', 'css', 'html', 'xml', 'yml', 'yaml', 'py', 'java', 'c', 'cpp', 'sql']

export function linkInfo(href: string) {
  let host = ''
  try {
    host = new URL(href).hostname.replace(/^www\./, '')
  } catch {
    /* ignore */
  }
  const platforms: [RegExp, string][] = [
    [/instagram\.com$/, 'Instagram'],
    [/(youtube\.com|youtu\.be)$/, 'YouTube'],
    [/tiktok\.com$/, 'TikTok'],
    [/(facebook\.com|fb\.com)$/, 'Facebook'],
    [/(twitter\.com|x\.com)$/, 'X (Twitter)'],
    [/linkedin\.com$/, 'LinkedIn'],
    [/github\.com$/, 'GitHub'],
    [/snapchat\.com$/, 'Snapchat'],
    [/(t\.me|telegram\.me)$/, 'Telegram'],
    [/(wa\.me|whatsapp\.com)$/, 'WhatsApp'],
  ]
  const hit = platforms.find(([re]) => re.test(host))
  return { name: hit ? hit[1] : 'Website', host }
}
