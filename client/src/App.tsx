import { useEffect } from 'react'
import { Loader2Icon } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthScreen } from '@/components/AuthScreen'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CreateRoomDialog } from '@/components/CreateRoomDialog'
import { FileViewer } from '@/components/FileViewer'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Sidebar } from '@/components/Sidebar'
import { StoryComposer } from '@/components/stories/StoryComposer'
import { StoryViewer } from '@/components/stories/StoryViewer'
import { cn } from '@/lib/utils'
import { useChat } from '@/store/chat'

function ChatApp() {
  const hasChat = useChat((s) => !!s.currentRoomId)
  return (
    <div className="grid h-svh grid-cols-1 md:grid-cols-[340px_1fr]">
      {/* On phones show the list or the chat, on desktop both side by side */}
      <Sidebar className={cn(hasChat && 'hidden md:flex')} />
      <ChatPanel className={cn(!hasChat && 'hidden md:flex')} />
      <SettingsDialog />
      <CreateRoomDialog />
      <StoryComposer />
      <StoryViewer />
      <FileViewer />
    </div>
  )
}

function Root() {
  const me = useChat((s) => s.me)
  const booting = useChat((s) => s.booting)
  const boot = useChat((s) => s.boot)

  useEffect(() => {
    boot()
  }, [boot])

  if (booting) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return me ? <ChatApp /> : <AuthScreen />
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <Root />
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
