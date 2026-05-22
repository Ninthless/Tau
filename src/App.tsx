import { useEffect, useRef, useState } from "react"
import { ChatView } from "./components/ChatView"
import { Sidebar } from "./components/Sidebar"
import { SettingsPage } from "./components/SettingsPage"
import { TitleBar } from "./components/TitleBar"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { SessionStats } from "./types"

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState("")
  const [sidebarCwd, setSidebarCwd] = useState<string | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)

  useEffect(() => {
    window.piAgent.getState().then((s) => setCurrentSessionId(s.sessionId)).catch(() => {})
    const unsub = window.piAgent.onStateChange((s) => setCurrentSessionId(s.sessionId))
    return unsub
  }, [])

  useEffect(() => {
    const refreshStats = () => {
      window.piAgent.getSessionStats().then(setSessionStats).catch(() => {})
    }
    refreshStats()
    const unsub = window.piAgent.onEvent((raw) => {
      const event = raw as Record<string, unknown>
      if (event.type === "agent_end" || event.type === "compaction_end") {
        refreshStats()
      }
    })
    const unsubState = window.piAgent.onStateChange((s) => {
      if (s.sessionId && s.sessionId !== currentSessionId) {
        refreshStats()
      }
    })
    return () => { unsub(); unsubState() }
  }, [currentSessionId])

  const switchPending = useRef(false)
  const [reloadKey, setReloadKey] = useState(0)

  const handleNewSession = async (cwd: string) => {
    await window.piAgent.newSession(cwd)
  }

  const handleSwitchSession = (path: string, cwd?: string, optimisticId?: string) => {
    if (switchPending.current) return
    switchPending.current = true
    if (optimisticId) setCurrentSessionId(optimisticId)
    window.piAgent.switchSession(path, cwd)
      .then(() => { setReloadKey((k) => k + 1) })
      .catch(() => {})
      .finally(() => { switchPending.current = false })
  }

  const handleSettingsBack = () => {
    setShowSettings(false)
  }

  return (
    <TooltipProvider delayDuration={500}>
      <div className="dark isolate flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} sessionStats={sessionStats} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showSettings ? (
            <SettingsPage onBack={handleSettingsBack} sidebarOpen={sidebarOpen} />
          ) : (
            <>
              {sidebarOpen && (
                <Sidebar
                  onNewSession={handleNewSession}
                  onSwitchSession={handleSwitchSession}
                  onOpenSettings={() => setShowSettings(true)}
                  currentSessionId={currentSessionId}
                  externalCwd={sidebarCwd}
                />
              )}
              <ChatView pendingSessionId={currentSessionId} reloadKey={reloadKey} />
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
