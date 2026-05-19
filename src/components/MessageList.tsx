import { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import { ToolBlock } from "./ToolBlock"
import type { ChatMessage } from "../types"

interface Props {
  messages: ChatMessage[]
}

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-600">
        Start a conversation
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
        >
          {msg.blocks.map((block, i) => {
            if (block.type === "text") {
              return msg.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[80%] rounded-2xl bg-accent/20 px-4 py-2 text-sm"
                >
                  {block.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="prose prose-invert prose-sm max-w-[85%] text-gray-200"
                >
                  <Markdown>{block.text}</Markdown>
                </div>
              )
            }

            if (block.type === "image") {
              return (
                <img
                  key={i}
                  className="max-h-64 max-w-[80%] rounded border border-border object-contain"
                  src={`data:${block.mimeType};base64,${block.data}`}
                  alt="attachment"
                />
              )
            }

            if (block.type === "thinking") {
              return <ThinkingBlock key={i} text={block.text} />
            }

            if (block.type === "tool_call") {
              return <ToolBlock key={i} block={block} />
            }

            return null
          })}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function ThinkingBlock({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="max-w-[85%] rounded border border-border bg-panel/50 text-xs">
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-gray-500 hover:text-gray-400"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>💭 Thinking</span>
        <span className="ml-auto">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="border-t border-border px-3 py-2 text-gray-500 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}
