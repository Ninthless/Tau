import { useCallback, useEffect, useState } from "react"
import type { SessionInfo } from "../types"

interface Props {
  onNewSession: (cwd: string) => void
  onSwitchSession: (path: string) => void
  currentSessionId: string
  externalCwd?: string
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function Sidebar({ onNewSession, onSwitchSession, currentSessionId, externalCwd }: Props) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [cwd, setCwd] = useState("")

  useEffect(() => {
    window.piAgent.getSettings().then((s) => {
      setCwd(s.defaultCwd || ".")
    }).catch(() => setCwd("."))
  }, [])

  useEffect(() => {
    if (externalCwd) setCwd(externalCwd)
  }, [externalCwd])

  const refresh = useCallback(async () => {
    try {
      const list = await window.piAgent.listSessions(cwd || ".")
      setSessions(list)
    } catch {
      setSessions([])
    }
  }, [cwd])

  useEffect(() => {
    refresh()
  }, [refresh, currentSessionId])

  return (
    <div className="flex w-56 flex-col border-r border-border bg-panel">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Sessions
        </span>
        <div className="flex gap-1">
          <button
            className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
            title="Refresh"
            onClick={refresh}
          >
            ↻
          </button>
          <button
            className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
            title="New session"
            onClick={() => onNewSession(cwd || ".")}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-600">No sessions found</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.path}
              className={`group flex w-full flex-col px-3 py-2 text-left hover:bg-white/5 ${
                currentSessionId === s.id
                  ? "bg-accent/20"
                  : ""
              }`}
              onClick={() => onSwitchSession(s.path)}
              title={s.path}
            >
              <span className={`truncate text-xs ${currentSessionId === s.id ? "text-accent" : "text-gray-300"}`}>
                {s.firstMessage || s.id.slice(0, 8)}
              </span>
              <span className="text-[10px] text-gray-600">
                {formatRelativeTime(s.modified)} · {s.messageCount} msgs
              </span>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        <input
          className="w-full rounded bg-surface px-2 py-1 text-xs text-gray-400 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/40"
          placeholder="Working directory…"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          onBlur={refresh}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
        />
      </div>
    </div>
  )
}
