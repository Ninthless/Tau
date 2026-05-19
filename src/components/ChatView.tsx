import { useCallback, useEffect, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { useAgent } from "../hooks/useAgent"
import type { ImageAttachment, SessionStats, SessionTreeItem, ToolInfo } from "../types"

type SendMode = "prompt" | "steer" | "followUp"

export function ChatView() {
  const { messages, agentState, sendPrompt, sendSteer, sendFollowUp, abort, compact, cycleThinkingLevel } = useAgent()
  const [input, setInput] = useState("")
  const [sendMode, setSendMode] = useState<SendMode>("prompt")
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [commands, setCommands] = useState<ToolInfo[]>([])
  const [forkTargets, setForkTargets] = useState<SessionTreeItem[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [panel, setPanel] = useState<"none" | "commands" | "fork" | "session">("none")
  const [sessionName, setSessionName] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshMeta = useCallback(async () => {
    const [nextStats, nextCommands, nextForkTargets] = await Promise.all([
      window.piAgent.getSessionStats(),
      window.piAgent.getTools(),
      window.piAgent.getSessionTree(),
    ])
    setStats(nextStats)
    setCommands(nextCommands)
    setForkTargets(nextForkTargets)
    setSessionName(nextStats?.sessionName ?? "")
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text && attachments.length === 0) return
    setInput("")
    setAttachments([])
    if (sendMode === "steer") {
      await sendSteer(text)
    } else if (sendMode === "followUp") {
      await sendFollowUp(text)
    } else {
      await sendPrompt(text, attachments)
    }
    refreshMeta().catch(() => {})
  }, [attachments, input, refreshMeta, sendMode, sendPrompt, sendSteer, sendFollowUp])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (!agentState.isStreaming) textareaRef.current?.focus()
  }, [agentState.isStreaming])

  useEffect(() => {
    refreshMeta().catch(() => {})
  }, [agentState.sessionId, agentState.isStreaming, refreshMeta])

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const images = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          }),
        }))
    )
    setAttachments((prev) => [...prev, ...images])
    if (fileRef.current) fileRef.current.value = ""
  }

  const saveSessionName = async () => {
    await window.piAgent.setSessionName(sessionName)
    await refreshMeta()
  }

  const exportHtml = async () => {
    const path = await window.piAgent.exportSessionHtml()
    setStatus(`Exported ${path}`)
  }

  const reloadSession = async () => {
    await window.piAgent.reloadSession()
    await refreshMeta()
    setStatus("Reloaded resources")
  }

  const modelLabel = agentState.model
    ? `${agentState.model.name} (${agentState.model.provider})`
    : "No model"

  const canSend = (!!input.trim() || attachments.length > 0) && (sendMode !== "prompt" || !agentState.isStreaming)

  const queueBadge = agentState.queuedSteering
    ? { label: "Steer queued", color: "text-orange-400" }
    : agentState.queuedFollowUp
    ? { label: "Follow-up queued", color: "text-blue-400" }
    : null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-xs text-gray-500 truncate">{modelLabel}</span>
        {stats && (
          <span className="hidden text-xs text-gray-600 md:inline">
            {stats.totalMessages} msgs · {stats.tokens.total} tok · ${stats.cost.toFixed(4)}
          </span>
        )}
        <button
          className="ml-auto rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-white/10 hover:text-gray-300"
          title="Cycle thinking level"
          onClick={cycleThinkingLevel}
        >
          💭 {agentState.thinkingLevel}
        </button>
        {agentState.isCompacting && (
          <span className="text-xs text-purple-400">Compacting…</span>
        )}
        {agentState.isRetrying && (
          <span className="text-xs text-orange-400">Retrying…</span>
        )}
        {agentState.isStreaming && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
            Running
          </span>
        )}
        {queueBadge && (
          <span className={`text-xs ${queueBadge.color}`}>{queueBadge.label}</span>
        )}
        <button
          className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-white/10 hover:text-gray-400"
          title="Session"
          onClick={() => setPanel((value) => value === "session" ? "none" : "session")}
        >
          session
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-white/10 hover:text-gray-400"
          title="Commands"
          onClick={() => setPanel((value) => value === "commands" ? "none" : "commands")}
        >
          commands
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-white/10 hover:text-gray-400"
          title="Fork from a previous user message"
          onClick={() => setPanel((value) => value === "fork" ? "none" : "fork")}
        >
          fork
        </button>
        <button
          className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-white/10 hover:text-gray-400"
          title="Compact context"
          onClick={() => compact()}
        >
          ⊡ compact
        </button>
      </div>

      {panel !== "none" && (
        <div className="max-h-52 overflow-y-auto border-b border-border bg-panel/70 px-4 py-3">
          {panel === "session" && (
            <div className="grid gap-3 text-xs md:grid-cols-[1fr_auto_auto]">
              <input
                className="rounded bg-surface px-3 py-1.5 text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                placeholder="Session name"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
              <button className="rounded bg-accent px-3 py-1.5 text-white hover:bg-accent/80" onClick={saveSessionName}>Save name</button>
              <button className="rounded bg-surface px-3 py-1.5 text-gray-300 hover:bg-white/10" onClick={exportHtml}>Export HTML</button>
              <button className="rounded bg-surface px-3 py-1.5 text-gray-300 hover:bg-white/10" onClick={reloadSession}>Reload resources</button>
              {status && <span className="self-center truncate text-gray-500 md:col-span-2">{status}</span>}
            </div>
          )}
          {panel === "commands" && (
            <div className="grid gap-2 md:grid-cols-2">
              {commands.map((tool) => (
                <button
                  key={tool.name}
                  className="rounded border border-border bg-surface px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/5"
                  onClick={() => setInput(tool.name)}
                  title={tool.description}
                >
                  <div className="font-medium">{tool.name}</div>
                  <div className="truncate text-[10px] text-gray-600">{tool.source}</div>
                </button>
              ))}
              {commands.length === 0 && (
                <div className="text-xs text-gray-600">No RPC commands available</div>
              )}
            </div>
          )}
          {panel === "fork" && (
            <div className="space-y-1">
              {forkTargets.map((item) => (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-white/5 ${item.active ? "text-accent" : "text-gray-400"}`}
                  style={{ paddingLeft: `${8 + item.depth * 14}px` }}
                  onClick={async () => { await window.piAgent.navigateTree(item.id); await refreshMeta() }}
                  title={item.title}
                >
                  <span className="w-20 shrink-0 text-[10px] text-gray-600">{item.type}</span>
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
              {forkTargets.length === 0 && (
                <div className="text-xs text-gray-600">No previous user messages to fork from</div>
              )}
            </div>
          )}
        </div>
      )}

      <MessageList messages={messages} />

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex gap-1">
          {(["prompt", "steer", "followUp"] as SendMode[]).map((mode) => (
            <button
              key={mode}
              className={`rounded px-2 py-0.5 text-xs ${
                sendMode === mode
                  ? "bg-accent text-white"
                  : "text-gray-500 hover:bg-white/10 hover:text-gray-300"
              }`}
              onClick={() => setSendMode(mode)}
            >
              {mode === "prompt" ? "Prompt" : mode === "steer" ? "Steer" : "Follow-up"}
            </button>
          ))}
          <span className="ml-2 text-xs text-gray-600 self-center">
            {sendMode === "steer"
              ? "Replaces current direction mid-run"
              : sendMode === "followUp"
              ? "Queued until agent stops"
              : ""}
          </span>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((image, index) => (
              <button
                key={`${image.name}-${index}`}
                className="flex items-center gap-2 rounded border border-border bg-panel px-2 py-1 text-xs text-gray-400 hover:bg-white/5"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                title="Remove attachment"
              >
                <img className="h-8 w-8 rounded object-cover" src={`data:${image.mimeType};base64,${image.data}`} alt="" />
                <span className="max-w-32 truncate">{image.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-lg bg-panel px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
            placeholder={
              sendMode === "steer"
                ? "Steer the agent mid-run…"
                : sendMode === "followUp"
                ? "Queue a follow-up…"
                : "Message Tau… (Enter to send, Shift+Enter for newline)"
            }
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMode === "prompt" && agentState.isStreaming}
          />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              className="rounded-lg bg-panel px-3 py-2 text-xs font-medium text-gray-400 hover:bg-white/10"
              onClick={() => fileRef.current?.click()}
              title="Attach images"
            >
              Image
            </button>
            {agentState.isStreaming && sendMode === "prompt" ? (
              <button
                className="rounded-lg bg-red-600/80 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                onClick={abort}
              >
                Stop
              </button>
            ) : (
              <button
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-40"
                onClick={handleSend}
                disabled={!canSend}
              >
                {sendMode === "steer" ? "Steer" : sendMode === "followUp" ? "Queue" : "Send"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
