import { useEffect, useState } from "react"
import { ChatView } from "./components/ChatView"
import { Sidebar } from "./components/Sidebar"
import { SettingsPage } from "./components/SettingsPage"
import { TitleBar } from "./components/TitleBar"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState("")
  const [sidebarCwd, setSidebarCwd] = useState<string | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    window.piAgent.getState().then((s) => setCurrentSessionId(s.sessionId)).catch(() => {})
    const unsub = window.piAgent.onStateChange((s) => setCurrentSessionId(s.sessionId))
    return unsub
  }, [])

  const handleNewSession = async (cwd: string) => {
    await window.piAgent.newSession(cwd)
  }

  const handleSwitchSession = async (path: string) => {
    await window.piAgent.switchSession(path)
  }

  const handleSettingsBack = () => {
    setShowSettings(false)
  }

  return (
    <TooltipProvider delayDuration={500}>
      <div className="dark isolate flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

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
              <ChatView />
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
