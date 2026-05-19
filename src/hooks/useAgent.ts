import { useCallback, useEffect, useRef, useState } from "react"
import type { AgentState, ChatMessage, MessageBlock, ThinkingLevel, ToolCallBlock } from "../types"

const INITIAL_STATE: AgentState = {
  isStreaming: false,
  sessionId: "",
  thinkingLevel: "low",
  model: undefined,
  queuedSteering: null,
  queuedFollowUp: null,
  isRetrying: false,
  isCompacting: false,
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agentState, setAgentState] = useState<AgentState>(INITIAL_STATE)
  const msgIdCounter = useRef(0)
  const currentAssistantId = useRef<string | null>(null)
  const prevSessionId = useRef<string>("")

  const nextId = () => String(++msgIdCounter.current)

  const loadMessages = useCallback(async () => {
    try {
      const history = await window.piAgent.getMessages()
      setMessages(history)
      msgIdCounter.current = history.length
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => {
    const unsub = window.piAgent.onEvent((raw) => {
      const event = raw as Record<string, unknown>

      if (event.type === "agent_start") {
        currentAssistantId.current = nextId()
        setMessages((prev) => [
          ...prev,
          { id: currentAssistantId.current!, role: "assistant", blocks: [] },
        ])
      }

      if (event.type === "message_update") {
        const ae = event.assistantMessageEvent as Record<string, unknown>
        if (!currentAssistantId.current) return

        if (ae.type === "text_delta") {
          const delta = ae.delta as string
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== currentAssistantId.current) return m
              const blocks = [...m.blocks]
              const last = blocks[blocks.length - 1]
              if (last?.type === "text") {
                blocks[blocks.length - 1] = { type: "text", text: last.text + delta }
              } else {
                blocks.push({ type: "text", text: delta })
              }
              return { ...m, blocks }
            })
          )
        }

        if (ae.type === "thinking_delta") {
          const delta = ae.delta as string
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== currentAssistantId.current) return m
              const blocks = [...m.blocks]
              const last = blocks[blocks.length - 1]
              if (last?.type === "thinking") {
                blocks[blocks.length - 1] = { ...last, text: last.text + delta }
              } else {
                blocks.push({ type: "thinking", text: delta, collapsed: false })
              }
              return { ...m, blocks }
            })
          )
        }
      }

      if (event.type === "tool_execution_start") {
        const toolCallId = event.toolCallId as string
        const toolName = event.toolName as string
        const args = (event.args as Record<string, unknown>) ?? {}
        if (!currentAssistantId.current) return
        const block: ToolCallBlock = {
          type: "tool_call",
          toolCallId,
          toolName,
          label: toolName,
          args,
          status: "running",
          collapsed: false,
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== currentAssistantId.current) return m
            return { ...m, blocks: [...m.blocks, block] }
          })
        )
      }

      if (event.type === "tool_execution_update") {
        const toolCallId = event.toolCallId as string
        const partialResult = event.partialResult as { content?: Array<{ type: string; text?: string }> } | undefined
        const partial = partialResult?.content?.find((c) => c.type === "text")?.text ?? ""
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            blocks: m.blocks.map((b): MessageBlock => {
              if (b.type === "tool_call" && b.toolCallId === toolCallId) {
                return { ...b, partialResult: partial }
              }
              return b
            }),
          }))
        )
      }

      if (event.type === "tool_execution_end") {
        const toolCallId = event.toolCallId as string
        const isError = (event.isError as boolean) ?? false
        const result = event.result as { content?: Array<{ type: string; text?: string }> } | undefined
        const resultText = result?.content?.find((c) => c.type === "text")?.text ?? ""
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            blocks: m.blocks.map((b): MessageBlock => {
              if (b.type === "tool_call" && b.toolCallId === toolCallId) {
                return { ...b, status: isError ? "error" : "done", result: resultText, partialResult: undefined, collapsed: true }
              }
              return b
            }),
          }))
        )
      }

      if (event.type === "agent_end") {
        currentAssistantId.current = null
      }
    })

    const unsubState = window.piAgent.onStateChange((state) => {
      setAgentState(state)
      if (state.sessionId && state.sessionId !== prevSessionId.current) {
        prevSessionId.current = state.sessionId
        currentAssistantId.current = null
        loadMessages()
      }
    })

    window.piAgent.getState().then((state) => {
      setAgentState(state)
      prevSessionId.current = state.sessionId
      return loadMessages()
    }).catch(() => {})

    return () => {
      unsub()
      unsubState()
    }
  }, [loadMessages])

  const sendPrompt = useCallback(async (text: string, images?: unknown[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "user",
        blocks: [
          { type: "text", text },
          ...((images as Array<{ data: string; mimeType: string }> | undefined)?.map((image) => ({
            type: "image" as const,
            data: image.data,
            mimeType: image.mimeType,
          })) ?? []),
        ],
      },
    ])
    await window.piAgent.prompt(text, images)
  }, [])

  const sendSteer = useCallback(async (text: string) => {
    await window.piAgent.steer(text)
  }, [])

  const sendFollowUp = useCallback(async (text: string) => {
    await window.piAgent.followUp(text)
  }, [])

  const abort = useCallback(() => window.piAgent.abort(), [])

  const compact = useCallback((instructions?: string) => window.piAgent.compact(instructions), [])

  const setThinkingLevel = useCallback((level: ThinkingLevel) => window.piAgent.setThinkingLevel(level), [])

  const cycleThinkingLevel = useCallback(() => window.piAgent.cycleThinkingLevel(), [])

  return {
    messages,
    agentState,
    sendPrompt,
    sendSteer,
    sendFollowUp,
    abort,
    compact,
    setThinkingLevel,
    cycleThinkingLevel,
  }
}
