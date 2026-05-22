import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { useAgent } from "../hooks/useAgent"
import type { ImageAttachment, ToolInfo } from "../types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  PromptInput,
  PromptInputTextarea,
} from "./prompt-kit/prompt-input"
import { Loader } from "./prompt-kit/loader"
import {
  ArrowUpIcon, AtSignIcon, DownloadIcon, GitForkIcon,
  GlobeIcon, ImageIcon, ListTreeIcon, MessageSquareTextIcon,
  PackageIcon, PaperclipIcon, PencilLineIcon, RefreshCwIcon,
  SquareIcon, WifiOffIcon, WrenchIcon, XIcon,
} from "lucide-react"

type SendMode = "prompt" | "steer" | "followUp"

type CmdItem = {
  id: string
  label: string
  hint: string
  icon: React.ElementType
  action: () => void
}

export function ChatView({ pendingSessionId, reloadKey }: { pendingSessionId?: string; reloadKey?: number }) {
  const {
    messages, agentState, rpcStatus,
    sendPrompt, sendSteer, sendFollowUp,
    abort, compact, cycleThinkingLevel,
    isLoadingMessages,
  } = useAgent(pendingSessionId, reloadKey)

  const [input, setInput] = useState("")
  const [sendMode, setSendMode] = useState<SendMode>("prompt")
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState("")
  const [cmdIndex, setCmdIndex] = useState(0)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.piAgent.getTools().then(setTools).catch(() => {})
  }, [])

  const builtinCmds = useMemo<CmdItem[]>(() => [
    { id: "steer", label: "Steer", hint: "Inject a steering message mid-run", icon: PencilLineIcon, action: () => { setSendMode("steer"); setCmdOpen(false); setInput("") } },
    { id: "followup", label: "Follow Up", hint: "Send a follow-up after the agent finishes", icon: MessageSquareTextIcon, action: () => { setSendMode("followUp"); setCmdOpen(false); setInput("") } },
    { id: "prompt", label: "Prompt", hint: "Send as a new prompt (default)", icon: ArrowUpIcon, action: () => { setSendMode("prompt"); setCmdOpen(false); setInput("") } },
    { id: "compact", label: "Compact", hint: "Compact conversation history", icon: PackageIcon, action: () => { compact(); setCmdOpen(false); setInput("") } },
    { id: "fork", label: "Fork", hint: "Fork from a session entry", icon: GitForkIcon, action: () => { setCmdOpen(false); setInput("") } },
    { id: "session", label: "Session Tree", hint: "Browse the session message tree", icon: ListTreeIcon, action: () => { setCmdOpen(false); setInput("") } },
    { id: "think", label: "Thinking Level", hint: `Cycle thinking level (current: ${agentState.thinkingLevel})`, icon: GlobeIcon, action: () => { cycleThinkingLevel(); setCmdOpen(false); setInput("") } },
    {
      id: "export", label: "Export", hint: "Export session as HTML", icon: DownloadIcon,
      action: async () => {
        const html = await window.piAgent.exportSessionHtml()
        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = "session.html"; a.click()
        URL.revokeObjectURL(url)
        setCmdOpen(false); setInput("")
      },
    },
    { id: "reload", label: "Reload", hint: "Reload current session", icon: RefreshCwIcon, action: () => { window.piAgent.reloadSession(); setCmdOpen(false); setInput("") } },
  ], [agentState.thinkingLevel, compact, cycleThinkingLevel])

  const toolCmds = useMemo<CmdItem[]>(() => tools.map((t) => ({
    id: `tool:${t.name}`,
    label: t.name,
    hint: t.description,
    icon: WrenchIcon,
    action: () => {
      const next = t.active
        ? tools.filter((x) => x.name !== t.name).map((x) => x.name)
        : [...tools.map((x) => x.name), t.name]
      window.piAgent.setActiveTools(next)
      setCmdOpen(false); setInput("")
    },
  })), [tools])

  const allCmds = useMemo(() => [...builtinCmds, ...toolCmds], [builtinCmds, toolCmds])

  const filteredCmds = useMemo(() => {
    if (!cmdQuery) return allCmds
    const q = cmdQuery.toLowerCase()
    return allCmds.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
  }, [allCmds, cmdQuery])

  const handleValueChange = useCallback((val: string) => {
    setInput(val)
    if (val.startsWith("/")) {
      setCmdOpen(true); setCmdQuery(val.slice(1)); setCmdIndex(0)
    } else {
      setCmdOpen(false); setCmdQuery("")
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || agentState.isStreaming || cmdOpen) return
    setInput("")
    if (sendMode === "steer") { await sendSteer(text); setSendMode("prompt") }
    else if (sendMode === "followUp") { await sendFollowUp(text); setSendMode("prompt") }
    else { await sendPrompt(text, images.length ? images : undefined); setImages([]) }
  }, [input, agentState.isStreaming, cmdOpen, sendMode, images, sendPrompt, sendSteer, sendFollowUp])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (cmdOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdIndex((i) => Math.min(i + 1, filteredCmds.length - 1)) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setCmdIndex((i) => Math.max(i - 1, 0)) }
      else if (e.key === "Enter") { e.preventDefault(); filteredCmds[cmdIndex]?.action() }
      else if (e.key === "Escape") { e.preventDefault(); setCmdOpen(false); setInput("") }
    }
  }, [cmdOpen, filteredCmds, cmdIndex])

  const handleImageAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const data = (ev.target?.result as string).split(",")[1]
        setImages((prev) => [...prev, { name: file.name, data, mimeType: file.type }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }, [])

  const thinkingLabel: Record<string, string> = {
    off: "No thinking",
    minimal: "Minimal",
    low: "Low thinking",
    medium: "Medium thinking",
    high: "High thinking",
    xhigh: "Max thinking",
  }

  const statusText = agentState.isCompacting ? "Compacting" : agentState.isRetrying ? "Retrying" : agentState.isStreaming ? "Running" : null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {isLoadingMessages ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader variant="typing" />
        </div>
      ) : (
        <MessageList
          messages={messages}
          isRetrying={agentState.isRetrying}
          isCompacting={agentState.isCompacting}
        />
      )}

      {rpcStatus === "disconnected" && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WifiOffIcon className="size-3.5 shrink-0" />
          <span className="flex-1">Agent process disconnected</span>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-destructive/20"
            onClick={() => window.piAgent.reconnect()}
          >
            <RefreshCwIcon className="size-3" />
            Reconnect
          </button>
        </div>
      )}

      <div className="relative shrink-0 px-3 pb-3">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-background" />
        {cmdOpen && filteredCmds.length > 0 && (
          <div className="mb-1.5 overflow-hidden rounded-lg border bg-popover shadow-md">
            <div className="max-h-52 overflow-y-auto py-0.5">
              {filteredCmds.map((cmd, i) => (
                <button
                  key={cmd.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                    i === cmdIndex ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent/50"
                  )}
                  onMouseEnter={() => setCmdIndex(i)}
                  onClick={cmd.action}
                >
                  <cmd.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{cmd.label}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">{cmd.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAttach} />

        <PromptInput
          value={input}
          onValueChange={handleValueChange}
          onSubmit={handleSend}
          isLoading={agentState.isStreaming}
          className="p-0 shadow-xl"
        >
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <AtSignIcon className="size-2.5" />
              Add context
            </button>

            {images.map((img, i) => (
              <div key={i} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                <ImageIcon className="size-2.5 shrink-0" />
                <span className="max-w-24 truncate">{img.name}</span>
                <button
                  type="button"
                  className="ml-0.5 transition-colors hover:text-foreground"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                >
                  <XIcon className="size-2.5" />
                </button>
              </div>
            ))}

            {sendMode !== "prompt" && (
              <div className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                sendMode === "steer" ? "border-warning/40 text-warning" : "border-info/40 text-info"
              )}>
                {sendMode === "steer" ? "Steer" : "Follow Up"}
                <button
                  type="button"
                  className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                  onClick={() => setSendMode("prompt")}
                >
                  <XIcon className="size-2.5" />
                </button>
              </div>
            )}

            {statusText && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader variant="dots" size="sm" />
                <span>{statusText}…</span>
              </div>
            )}
          </div>

          <PromptInputTextarea
            placeholder={
              sendMode === "steer" ? "Steer the agent…"
              : sendMode === "followUp" ? "Follow up…"
              : "Ask, search, or make anything… (/ for commands)"
            }
            onKeyDown={handleKeyDown}
            className="min-h-[44px] px-3 py-1.5"
          />

          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center transition-colors hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PaperclipIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach image</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-[11px] transition-colors hover:text-foreground"
                    onClick={() => cycleThinkingLevel()}
                  >
                    {thinkingLabel[agentState.thinkingLevel] ?? "Auto"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Thinking: {agentState.thinkingLevel}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] transition-colors hover:text-foreground"
                  >
                    <GlobeIcon className="size-3" />
                    <span className="max-w-24 truncate">{agentState.model?.name ?? "All Sources"}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{agentState.model?.name ?? "Model"}</TooltipContent>
              </Tooltip>
            </div>

            {agentState.isStreaming ? (
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-75"
                onClick={abort}
              >
                <SquareIcon className="size-2.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full bg-foreground text-background transition-opacity",
                  !input.trim() || cmdOpen ? "cursor-not-allowed opacity-25" : "hover:opacity-75"
                )}
                disabled={!input.trim() || cmdOpen}
                onClick={handleSend}
              >
                <ArrowUpIcon className="size-3.5" />
              </button>
            )}
          </div>
        </PromptInput>
      </div>
    </div>
  )
}
