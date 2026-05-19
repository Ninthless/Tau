import { useEffect, useState } from "react"
import { ChatView } from "./components/ChatView"
import { Sidebar } from "./components/Sidebar"
import { SettingsModal } from "./components/SettingsModal"

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState("")
  const [sidebarCwd, setSidebarCwd] = useState<string | undefined>(undefined)

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

  const handleSettingsClose = (savedCwd?: string) => {
    setShowSettings(false)
    if (savedCwd) setSidebarCwd(savedCwd)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-gray-200">
      <Sidebar
        onNewSession={handleNewSession}
        onSwitchSession={handleSwitchSession}
        currentSessionId={currentSessionId}
        externalCwd={sidebarCwd}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-semibold text-gray-300">Tau</span>
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
        </div>

        <ChatView />
      </div>

      {showSettings && <SettingsModal onClose={handleSettingsClose} />}
    </div>
  )
}
